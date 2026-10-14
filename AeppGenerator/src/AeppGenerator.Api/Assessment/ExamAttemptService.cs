using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using AeppGenerator.Api.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace AeppGenerator.Api.Assessment;

public sealed class ExamAttemptService(AssessmentDbContext db, ExamCatalog catalog, AccountStore accounts)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public Task<RandomExamResponse?> GetRandomPracticeExam(CancellationToken ct) => catalog.GetRandomPracticeExam(db, ct);

    public async Task<AttemptDetail> Start(string userId, StartAttemptRequest request, CancellationToken ct)
    {
        if (request.AttemptId == Guid.Empty) throw new ArgumentException("Απαιτείται αναγνωριστικό προσπάθειας.");
        var exam = await catalog.Resolve(db, request, userId, ct);
        var existing = await db.ExamAttempts.AsNoTracking().SingleOrDefaultAsync(attempt => attempt.Id == request.AttemptId, ct);
        if (existing is not null)
        {
            if (existing.UserId != userId) throw new AttemptNotFoundException();
            if (existing.ExamId != exam.Id) throw new AttemptConflictException("Το αναγνωριστικό προσπάθειας χρησιμοποιείται για άλλο διαγώνισμα.");
            return await Get(existing.Id, userId, false, ct);
        }
        db.ExamAttempts.Add(new ExamAttempt { Id = request.AttemptId, UserId = userId, ExamId = exam.Id, StartedAt = DateTime.UtcNow, Status = ExamAttemptStatus.IN_PROGRESS });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException error) when (error.InnerException is SqliteException { SqliteErrorCode: 19 })
        {
            db.ChangeTracker.Clear();
            var duplicate = await db.ExamAttempts.AsNoTracking().SingleOrDefaultAsync(attempt => attempt.Id == request.AttemptId && attempt.UserId == userId, ct);
            if (duplicate is null) throw;
            if (duplicate.ExamId != exam.Id) throw new AttemptConflictException("Το αναγνωριστικό προσπάθειας χρησιμοποιείται για άλλο διαγώνισμα.");
        }
        return await Get(request.AttemptId, userId, false, ct);
    }

    public async Task<AttemptDetail> Submit(string userId, SubmitAttemptRequest request, CancellationToken ct)
    {
        var attempt = await db.ExamAttempts.Include(item => item.Exam).SingleOrDefaultAsync(item => item.Id == request.AttemptId && item.UserId == userId, ct) ?? throw new AttemptNotFoundException();
        if (request.Questions is null || request.Questions.Count is < 1 or > 200 || request.Questions.Any(question => question is null))
            throw new ArgumentException("Μη έγκυρη υποβολή ερωτημάτων.");
        var hash = Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(request, Json)));
        if (attempt.Status != ExamAttemptStatus.IN_PROGRESS)
        {
            if (attempt.SubmissionHash != hash) throw new AttemptConflictException("Η προσπάθεια έχει ήδη υποβληθεί. Ξεκίνησε νέα προσπάθεια για διαφορετικές απαντήσεις.");
            return await Get(attempt.Id, userId, false, ct);
        }
        var definition = JsonNode.Parse(attempt.Exam.DefinitionJson)!;
        var reportSections = new JsonArray();
        var submissions = request.Questions.ToDictionary(question => question.QuestionId, StringComparer.Ordinal);
        var expected = definition["sections"]!.AsArray().Sum(section => section!["questions"]!.AsArray().Count);
        if (submissions.Count != expected) throw new ArgumentException("Απαιτείται ακριβώς μία υποβολή για κάθε ερώτημα.");
        decimal total = 0, pending = 0;
        var position = 0;
        foreach (var section in definition["sections"]!.AsArray())
        {
            var theme = section!["theme"]!.GetValue<string>();
            var results = new JsonArray();
            decimal sectionScore = 0, sectionPending = 0;
            foreach (var question in section["questions"]!.AsArray())
            {
                var id = question!["id"]!.GetValue<string>();
                if (!submissions.TryGetValue(id, out var submitted)) throw new ArgumentException("Η υποβολή περιέχει άγνωστα ή ελλιπή ερωτήματα.");
                var max = question["marks"]!.GetValue<decimal>();
                if (submitted.MaxPoints != max || submitted.AutoPoints < 0 || submitted.AutoPoints > max || decimal.Round(submitted.AutoPoints, 2) != submitted.AutoPoints)
                    throw new ArgumentException("Οι μονάδες της υποβολής δεν συμφωνούν με το διαγώνισμα.");
                var answer = ParseAnswer(submitted.StudentAnswerJson);
                var tests = ParseTests(submitted.TestResultsJson);
                var kind = question["kind"]!.GetValue<string>();
                var review = kind is "open" or "program";
                if (review && submitted.AutoPoints != 0) throw new ArgumentException("Τα ερωτήματα ελέγχου καθηγητή δεν έχουν αυτόματες μονάδες.");
                if (kind != "program" && tests.Count != 0) throw new ArgumentException("Δοκιμές εκτέλεσης επιτρέπονται μόνο σε ερωτήματα προγραμματισμού.");
                // Αντικειμενικά ερωτήματα: νέα διόρθωση με την επίσημη τράπεζα στο API.
                // Ο browser δεν είναι έμπιστη βαθμολογική αρχή για υποβολές προγραμματισμού.
                var points = review ? 0 : kind == "program" ? string.IsNullOrWhiteSpace(Text(answer)) ? 0 : submitted.AutoPoints : ObjectiveScore(question, answer, max);
                var waiting = review ? max : 0;
                db.QuestionSubmissions.Add(new QuestionSubmission {
                    Id = Guid.NewGuid(), ExamAttemptId = attempt.Id, QuestionId = id,
                    Theme = theme, QuestionCode = question["code"]!.GetValue<string>(), Position = position++,
                    StudentAnswerJson = submitted.StudentAnswerJson, TestResultsJson = submitted.TestResultsJson,
                    AutoPoints = points, MaxPoints = max
                });
                var result = new JsonObject {
                    ["questionId"] = id, ["code"] = question["code"]!.DeepClone(), ["earned"] = points, ["max"] = max, ["pending"] = waiting,
                    ["feedback"] = review ? "Η απάντηση χρειάζεται αξιολόγηση από καθηγητή." : kind == "program" ? (submitted.Feedback ?? "Προσωρινή αξιολόγηση από δοκιμές στον browser.") : $"{points}/{max} μονάδες από έλεγχο των απαντήσεων στον διακομιστή.",
                    ["studentAnswer"] = submitted.StudentAnswer ?? Text(answer), ["expectedAnswer"] = question["solution"]!.DeepClone(),
                    ["chapter"] = question["chapter"]!.DeepClone()
                };
                if (kind == "program") {
                    result["studentCode"] = Text(answer); result["referenceCode"] = question["referenceCode"]!.DeepClone();
                    result["programCases"] = tests; result["astSummary"] = submitted.AstSummary ?? "";
                }
                results.Add(result); sectionScore += points; sectionPending += waiting;
            }
            total += sectionScore; pending += sectionPending;
            reportSections.Add(new JsonObject { ["theme"] = theme, ["earned"] = sectionScore, ["pending"] = sectionPending, ["max"] = section["marks"]!.DeepClone(), ["questions"] = results });
        }
        attempt.AutoGradeScore = total;
        attempt.FinalScore = total;
        attempt.SubmittedAt = DateTime.UtcNow;
        attempt.Status = ExamAttemptStatus.SUBMITTED;
        attempt.Version++;
        attempt.SubmissionHash = hash;
        attempt.ReportJson = new JsonObject {
            ["title"] = attempt.Exam.Title, ["earned"] = total, ["pending"] = pending, ["max"] = 100,
            ["grade20"] = decimal.Round(total / 5, 2, MidpointRounding.AwayFromZero), ["sections"] = reportSections,
            ["recommendations"] = new JsonArray("Μελέτησε την αναλυτική διόρθωση και ζήτησε από τον καθηγητή επίσημη αξιολόγηση.")
        }.ToJsonString();
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            db.ChangeTracker.Clear();
            var completed = await db.ExamAttempts.AsNoTracking().SingleAsync(item => item.Id == request.AttemptId && item.UserId == userId, ct);
            if (completed.SubmissionHash != hash) throw new AttemptConflictException("Η προσπάθεια ενημερώθηκε από άλλη υποβολή.");
        }
        return await Get(attempt.Id, userId, false, ct);
    }

    public async Task<AttemptDetail> Grade(string teacherId, Guid attemptId, GradeAttemptRequest request, CancellationToken ct)
    {
        if (accounts.FindUser(teacherId)?.Role != "TEACHER") throw new UnauthorizedAccessException();
        if (request.RevisedScore is not { } score || score is < 0 or > 100 || decimal.Round(score, 2) != score || string.IsNullOrWhiteSpace(request.TeacherComments) || request.TeacherComments.Length > 5000)
            throw new ArgumentException("Δώσε βαθμό 0–100 με έως δύο δεκαδικά και σχόλιο αξιολόγησης.");
        var attempt = await db.ExamAttempts.SingleOrDefaultAsync(item => item.Id == attemptId, ct) ?? throw new AttemptNotFoundException();
        if (attempt.Status == ExamAttemptStatus.IN_PROGRESS) throw new AttemptConflictException("Η προσπάθεια δεν έχει υποβληθεί ακόμη.");
        if (attempt.Version != request.ExpectedVersion) throw new AttemptConflictException("Υπάρχει νεότερη αξιολόγηση. Ανανέωσε την προσπάθεια πριν αποθηκεύσεις.");
        attempt.FinalScore = score;
        attempt.Status = ExamAttemptStatus.GRADED_BY_TEACHER;
        attempt.Version++;
        db.GradeRevisions.Add(new GradeRevision { Id = Guid.NewGuid(), ExamAttemptId = attemptId, TeacherId = teacherId, RevisedScore = score, TeacherComments = request.TeacherComments.Trim(), RevisedAt = DateTime.UtcNow, Version = attempt.Version });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { throw new AttemptConflictException("Η αξιολόγηση άλλαξε από άλλη καταχώριση. Ανανέωσε την προσπάθεια."); }
        return await Get(attemptId, teacherId, true, ct);
    }

    public async Task<AttemptPage> History(string userId, bool teacherQueue, int page, int pageSize, CancellationToken ct)
    {
        if (page is < 1 or > 1000000 || pageSize is < 1 or > 50) throw new ArgumentException("Μη έγκυρη σελιδοποίηση ιστορικού.");
        var query = db.ExamAttempts.AsNoTracking().Where(item => teacherQueue ? item.Status != ExamAttemptStatus.IN_PROGRESS : item.UserId == userId);
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(item => item.StartedAt).ThenByDescending(item => item.Id).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(item => new { item.Id, item.ExamId, ExamTitle = item.Exam.Title, StudentName = item.User.FullName,
                item.StartedAt, item.SubmittedAt, item.AutoGradeScore, item.FinalScore, item.Status, item.Version,
                RevisionCount = item.GradeRevisions.Count,
                Questions = item.QuestionSubmissions.Select(question => new { question.Theme, question.AutoPoints, question.MaxPoints }).ToList() })
            .ToListAsync(ct);
        return new(rows.Select(item => new AttemptSummary(item.Id, item.ExamId, item.ExamTitle, item.StudentName, item.StartedAt, item.SubmittedAt, item.AutoGradeScore, item.FinalScore, item.Status, item.Version, item.RevisionCount,
            item.Questions.GroupBy(question => question.Theme).OrderBy(group => group.Key, StringComparer.Ordinal).Select(group => new SectionScore(group.Key, group.Sum(question => question.AutoPoints), group.Sum(question => question.MaxPoints))).ToList())).ToList(), total, page, pageSize);
    }

    public async Task<AttemptDetail> Get(Guid id, string userId, bool teacher, CancellationToken ct)
    {
        var attempt = await db.ExamAttempts.AsNoTracking().AsSplitQuery().Include(item => item.Exam).Include(item => item.User)
            .Include(item => item.QuestionSubmissions).Include(item => item.GradeRevisions).ThenInclude(revision => revision.Teacher)
            .SingleOrDefaultAsync(item => item.Id == id && (item.UserId == userId || teacher && item.Status != ExamAttemptStatus.IN_PROGRESS), ct) ?? throw new AttemptNotFoundException();
        using var exam = JsonDocument.Parse(attempt.Exam.DefinitionJson);
        using var report = JsonDocument.Parse(attempt.ReportJson);
        var publicExam = teacher && attempt.Status != ExamAttemptStatus.IN_PROGRESS
            ? exam.RootElement.Clone()
            : ExamPublicProjection.ForTaking(exam.RootElement);
        return new(attempt.Id, attempt.ExamId, attempt.Exam.Title, attempt.User.FullName, attempt.StartedAt, attempt.SubmittedAt,
            attempt.AutoGradeScore, attempt.FinalScore, attempt.Status, attempt.Version, publicExam,
            attempt.Status == ExamAttemptStatus.IN_PROGRESS ? null : report.RootElement.Clone(),
            attempt.QuestionSubmissions.OrderBy(question => question.Position).Select(question => new QuestionSubmissionDto(question.Id, question.QuestionId, question.Theme, question.QuestionCode, question.StudentAnswerJson, question.TestResultsJson, question.AutoPoints, question.MaxPoints)).ToList(),
            attempt.GradeRevisions.OrderBy(revision => revision.Version).Select(revision => new GradeRevisionDto(revision.Id, revision.TeacherId, revision.Teacher.FullName, revision.RevisedScore, revision.TeacherComments, revision.RevisedAt, revision.Version)).ToList());
    }

    private static JsonNode? ParseAnswer(string json)
    {
        if (string.IsNullOrWhiteSpace(json) || json.Length > 100000) throw new ArgumentException("Μη έγκυρη απάντηση.");
        var answer = JsonNode.Parse(json, documentOptions: new JsonDocumentOptions { MaxDepth = 4 });
        bool IsString(JsonNode? value) => value is JsonValue scalar && scalar.TryGetValue<string>(out _);
        if (answer is JsonObject map && map.Count <= 1000 && map.All(item => item.Key.Length <= 200 && IsString(item.Value)) || answer is JsonArray rows && rows.Count <= 1000 && rows.All(row => row is JsonArray cells && cells.Count <= 100 && cells.All(IsString)) || IsString(answer)) return answer;
        throw new ArgumentException("Η απάντηση πρέπει να είναι κείμενο, αντιστοίχιση ή πίνακας τιμών.");
    }

    private static JsonArray ParseTests(string json)
    {
        if (string.IsNullOrWhiteSpace(json) || json.Length > 200000) throw new ArgumentException("Μη έγκυρα αποτελέσματα δοκιμών.");
        if (JsonNode.Parse(json, documentOptions: new JsonDocumentOptions { MaxDepth = 6 }) is not JsonArray tests || tests.Count > 50)
            throw new ArgumentException("Απαιτείται λίστα αποτελεσμάτων δοκιμών.");
        var ids = new HashSet<string>();
        foreach (var test in tests)
        {
            if (test is not JsonObject item || item["id"] is not JsonValue idNode || !idNode.TryGetValue<string>(out var id) || id.Length is < 1 or > 200 || !ids.Add(id)
                || item["passed"] is not JsonValue pass || !pass.TryGetValue<bool>(out _) || item["actual"] is not JsonArray actual || actual.Count > 1000 || actual.Any(value => value is not JsonValue text || !text.TryGetValue<string>(out _)))
                throw new ArgumentException("Μη έγκυρη δομή αποτελέσματος δοκιμής.");
        }
        return tests;
    }

    private static string Text(JsonNode? answer) => answer is JsonValue value && value.TryGetValue<string>(out var text) ? text : answer?.ToJsonString() ?? "";
    private static string Normalize(string value) => Regex.Replace(string.Concat(value.Normalize(NormalizationForm.FormD).Where(character => CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark)), @"\s", "").ToUpperInvariant();
    private static decimal ObjectiveScore(JsonNode question, JsonNode? answer, decimal max)
    {
        string At(string id) => answer is JsonObject map ? Text(map[id]) : "";
        bool Accepted(JsonNode? values, string value) => values!.AsArray().Any(expected => Normalize(Text(expected)) == Normalize(value));
        int correct = 0, count = 0;
        switch (question["kind"]!.GetValue<string>())
        {
            case "trueFalse": foreach (var item in question["statements"]!.AsArray()) { count++; if (At(item!["id"]!.GetValue<string>()) == (item["answer"]!.GetValue<bool>() ? "Σωστό" : "Λάθος")) correct++; } break;
            case "matching": foreach (var item in question["pairs"]!.AsArray()) { count++; if (At(item!["id"]!.GetValue<string>()) == item["rightId"]!.GetValue<string>()) correct++; } break;
            case "choice": count = 1; correct = Text(answer) == question["correctId"]!.GetValue<string>() ? 1 : 0; break;
            case "fill": count = 1; correct = Accepted(question["accepted"], Text(answer)) ? 1 : 0; break;
            case "codeBlanks": foreach (var item in question["blanks"]!.AsArray()) { count++; if (Accepted(item!["accepted"], At(item["id"]!.GetValue<string>()))) correct++; } break;
            case "trace":
                var rows = answer as JsonArray;
                var expected = question["expected"]!.AsArray();
                for (var row = 0; row < expected.Count; row++) for (var column = 0; column < expected[row]!.AsArray().Count; column++) {
                    count++; var cells = rows is not null && row < rows.Count ? rows[row] as JsonArray : null;
                    if (Normalize(cells is not null && column < cells.Count ? Text(cells[column]) : "") == Normalize(Text(expected[row]![column]))) correct++;
                }
                break;
            default: throw new ArgumentException("Μη υποστηριζόμενος τύπος ερωτήματος.");
        }
        return count == 0 ? 0 : decimal.Round(max * correct / count, 2, MidpointRounding.AwayFromZero);
    }
}
