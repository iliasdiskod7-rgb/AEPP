using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using AeppGenerator.Api.Data;
using AeppGenerator.Application.Llm;
using Microsoft.EntityFrameworkCore;

namespace AeppGenerator.Api.Assessment;

public sealed class ExamCatalog
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly string practiceJson;
    public string PracticeId { get; }
    public ExamCatalog()
    {
        using var stream = typeof(ExamCatalog).Assembly.GetManifestResourceStream("AeppGenerator.PracticeExam")!;
        using var reader = new StreamReader(stream);
        practiceJson = reader.ReadToEnd();
        var definition = JsonNode.Parse(practiceJson)!.AsObject();
        Validate(definition);
        PracticeId = definition["id"]!.GetValue<string>();
    }

    public async Task Seed(AssessmentDbContext db, CancellationToken ct)
    {
        await ExamDbInitializer.SeedAsync(db, practiceJson, ct);
    }

    public async Task<RandomExamResponse?> GetRandomPracticeExam(AssessmentDbContext db, CancellationToken ct)
    {
        var ids = Enumerable.Range(1, 10).Select(number => number == 1 ? PracticeId : $"aepp-model-{number:00}").ToArray();
        var exams = await db.Exams.AsNoTracking().Where(exam => exam.Source == "practice" && ids.Contains(exam.Id)).ToListAsync(ct);
        if (exams.Count == 0) return null;
        var selected = exams[Random.Shared.Next(exams.Count)];
        using var definition = JsonDocument.Parse(selected.DefinitionJson);
        var hiddenTestCases = definition.RootElement.GetProperty("sections").EnumerateArray()
            .SelectMany(section => section.GetProperty("questions").EnumerateArray())
            .Where(question => question.TryGetProperty("testCases", out _))
            .Sum(question => question.GetProperty("testCases").GetArrayLength());
        return new(selected.Id, selected.Title, ExamPublicProjection.ForTaking(definition.RootElement), hiddenTestCases);
    }

    public async Task<Exam> Resolve(AssessmentDbContext db, StartAttemptRequest request, string userId, CancellationToken ct)
    {
        if (request.GeneratedExam is null)
            return await db.Exams.SingleOrDefaultAsync(exam => exam.Id == request.ExamId && (exam.Source == "practice" || exam.CreatedByUserId == userId), ct) ?? throw new AttemptNotFoundException();
        if (request.ExamId == PracticeId) throw new ArgumentException("Το διαγώνισμα εξάσκησης δεν μπορεί να αντικατασταθεί.");
        var source = request.GeneratedExam;
        if (string.IsNullOrWhiteSpace(source.Title) || source.Title.Length > 200 || source.DurationMinutes is < 1 or > 480 || source.Sections is null || source.Sections.Count != 4)
            throw new ArgumentException("Μη έγκυρη δομή διαγωνίσματος.");
        var sections = new JsonArray();
        foreach (var section in source.Sections)
        {
            if (section is null || section.Questions is null) throw new ArgumentException("Μη έγκυρο θέμα διαγωνίσματος.");
            var questions = new JsonArray();
            foreach (var question in section.Questions)
            {
                if (question is null || string.IsNullOrWhiteSpace(question.Code) || question.Code.Length > 100 || string.IsNullOrWhiteSpace(question.QuestionText) || question.SolutionText is null)
                    throw new ArgumentException("Μη έγκυρο ερώτημα διαγωνίσματος.");
                var program = section.Theme is "Θέμα Γ" or "Θέμα Δ";
                var reference = program ? Regex.Match(question.SolutionText, @"```(?:glossa|ΓΛΩΣΣΑ)\s*\n([\s\S]*?)```", RegexOptions.IgnoreCase).Groups[1].Value.Trim() : "";
                var item = new JsonObject {
                    ["id"] = section.Theme + "-" + question.Code, ["code"] = question.Code, ["title"] = question.Code,
                    ["prompt"] = question.QuestionText + (string.IsNullOrEmpty(question.GlowCodeSnippet) ? "" : "\n\n```glossa\n" + question.GlowCodeSnippet + "\n```"),
                    ["marks"] = (decimal)question.Marks, ["chapter"] = "Ύλη διαγωνίσματος", ["solution"] = question.SolutionText, ["kind"] = program ? "program" : "open"
                };
                if (program) {
                    item["referenceCode"] = reference; item["gradingMode"] = "review";
                    item["testCases"] = JsonSerializer.SerializeToNode(question.TestCases ?? [], Json); item["rubric"] = new JsonArray();
                }
                questions.Add(item);
            }
            sections.Add(new JsonObject { ["theme"] = section.Theme, ["marks"] = (decimal)section.TotalMarks, ["questions"] = questions });
        }
        var generated = new JsonObject { ["title"] = source.Title, ["durationMinutes"] = source.DurationMinutes, ["source"] = "generated", ["sections"] = sections };
        Validate(generated);
        // Ισχυρό hash και ιδιοκτήτης: καμία σύγκρουση με ιδιωτικό διαγώνισμα άλλου μαθητή.
        var id = "generated-" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(userId + "\n" + generated.ToJsonString()))).ToLowerInvariant();
        generated["id"] = id;
        var existing = await db.Exams.SingleOrDefaultAsync(exam => exam.Id == id, ct);
        if (existing is not null) return existing;
        var exam = new Exam { Id = id, Title = source.Title, Source = "generated", CreatedByUserId = userId, DefinitionJson = generated.ToJsonString(), CreatedAt = DateTime.UtcNow };
        db.Exams.Add(exam);
        return exam;
    }

    private static void Validate(JsonObject definition)
    {
        var expectedThemes = new[] { "Θέμα Α", "Θέμα Β", "Θέμα Γ", "Θέμα Δ" };
        var sections = definition["sections"]?.AsArray();
        if (sections is null || sections.Count != 4) throw new ArgumentException("Απαιτούνται τέσσερα θέματα.");
        var ids = new HashSet<string>();
        for (var index = 0; index < sections.Count; index++)
        {
            var section = sections[index]!;
            var questions = section["questions"]?.AsArray();
            if (section["theme"]?.GetValue<string>() != expectedThemes[index] || section["marks"]?.GetValue<decimal>() != 25 || questions is null || questions.Count is < 1 or > 50)
                throw new ArgumentException("Απαιτούνται τα Θέματα Α, Β, Γ, Δ με 25 μονάδες το καθένα.");
            decimal marks = 0;
            foreach (var question in questions)
            {
                var id = question?["id"]?.GetValue<string>();
                var points = question?["marks"]?.GetValue<decimal>() ?? 0;
                if (string.IsNullOrWhiteSpace(id) || id.Length > 200 || !ids.Add(id) || points <= 0 || points > 25 || decimal.Round(points, 2) != points)
                    throw new ArgumentException("Μη έγκυρα αναγνωριστικά ή μονάδες ερωτημάτων.");
                marks += points;
            }
            if (marks != 25) throw new ArgumentException("Οι μονάδες των ερωτημάτων πρέπει να αθροίζονται σε 25 ανά θέμα.");
        }
    }
}
