using System.Text.Json;
using System.Text.Json.Serialization;
using AeppGenerator.Application.Exams;
using AeppGenerator.Application.Llm;
using AeppGenerator.Infrastructure.Prompts;
using BankSection = AeppGenerator.Application.Llm.ExamSectionDto;

namespace AeppGenerator.Infrastructure.Services;

public sealed class LocalExamBank
{
    public const string Notification = "⚠️ Το AI είναι προσωρινά υπερφορτωμένο. Φορτώθηκε πρότυπο διαγώνισμα από την Τράπεζα Θεμάτων μας!";
    private static readonly string[] Themes = ["Θέμα Α", "Θέμα Β", "Θέμα Γ", "Θέμα Δ"];
    private readonly BankDocument bank;

    public LocalExamBank()
    {
        // Ενσωματωμένο JSON: διαθέσιμο και σε publish, χωρίς εξάρτηση από working directory ή δίκτυο.
        using var stream = typeof(LocalExamBank).Assembly.GetManifestResourceStream(
            "AeppGenerator.Infrastructure.ExamBank.pregenerated_exams.json")
            ?? throw new InvalidDataException("Η τοπική τράπεζα διαγωνισμάτων δεν βρέθηκε.");
        bank = JsonSerializer.Deserialize<BankDocument>(stream, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
        }) ?? throw new InvalidDataException("Η τοπική τράπεζα είναι κενή.");
        if (bank.SchemaVersion != 1 || bank.Exams is null || bank.Exams.Count < 3)
            throw new InvalidDataException("Μη έγκυρη έκδοση ή πλήθος προτύπων.");
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var entry in bank.Exams)
        {
            if (entry is null || string.IsNullOrWhiteSpace(entry.Id) || !ids.Add(entry.Id) ||
                entry.Topics is null || entry.Topics.Count == 0 || entry.Keywords is null)
                throw new InvalidDataException("Μη έγκυρα μεταδεδομένα προτύπου.");
            var request = new GenerateExamRequest { TargetTopics = entry.Topics, Difficulty = entry.Difficulty };
            GlowSystemPrompts.BuildUserPrompt(request);
            LlmExamGeneratorService.ValidateResponse(entry.Exam, request);
            foreach (var section in entry.Exam.Sections)
            foreach (var question in section.Questions)
            {
                if (question.TestCases is null ||
                    ((section.Theme is "Θέμα Γ" or "Θέμα Δ") && question.TestCases.Count < 2) ||
                    question.TestCases.Any(test => test is null || string.IsNullOrWhiteSpace(test.Id) ||
                        test.Inputs is null || test.ExpectedOutput is null || test.ExpectedOutput.Count == 0) ||
                    question.TestCases.Select(test => test.Id).Distinct().Count() != question.TestCases.Count)
                    throw new InvalidDataException("Μη έγκυρες δοκιμές προτύπου.");
            }
        }
    }

    public ExamDto GetExam(GenerateExamRequest request, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        GlowSystemPrompts.BuildUserPrompt(request);
        var entry = bank.Exams.OrderByDescending(item => request.TargetTopics.Sum(topic =>
                (item.Keywords.Any(keyword => topic.Contains(keyword, StringComparison.OrdinalIgnoreCase)) ? 5 : 0) +
                (item.Topics.Any(keyword => topic.Contains(keyword, StringComparison.OrdinalIgnoreCase)) ? 1 : 0)))
            .ThenByDescending(item => item.Difficulty == request.Difficulty).ThenBy(item => item.Id).First();
        var selected = Themes.Where(request.IncludeThemes.Contains).ToArray();
        var source = new ExamJsonResponseDto
        {
            Title = entry.Exam.Title, DurationMinutes = entry.Exam.DurationMinutes,
            Sections = selected.Select((theme, index) =>
            {
                var original = entry.Exam.Sections.Single(section => section.Theme == theme);
                var total = 100 / selected.Length + (index < 100 % selected.Length ? 1 : 0);
                var marks = original.Questions.Select(q => q.Marks * total / original.TotalMarks).ToArray();
                var remainder = total - marks.Sum();
                foreach (var questionIndex in Enumerable.Range(0, marks.Length)
                    .OrderByDescending(i => original.Questions[i].Marks * total % original.TotalMarks).Take(remainder))
                    marks[questionIndex]++;
                return new BankSection
                {
                    Theme = theme, TotalMarks = total,
                    Questions = original.Questions.Select((q, i) => new QuestionDto
                    {
                        Code = q.Code, QuestionText = q.QuestionText, GlowCodeSnippet = q.GlowCodeSnippet,
                        SolutionText = q.SolutionText, Marks = marks[i],
                        TestCases = q.TestCases?.Select(t => new ExamTestCaseDto(t.Id, [..t.Inputs], [..t.ExpectedOutput])).ToList()
                    }).ToList()
                };
            }).ToList()
        };
        var actual = new GenerateExamRequest
        {
            TargetTopics = [..entry.Topics], Difficulty = entry.Difficulty, IncludeThemes = [..selected]
        };
        LlmExamGeneratorService.ValidateResponse(source, actual);
        return LlmExamGeneratorService.MapExam(source, actual) with
        {
            GenerationSource = "examBank", FallbackMessage = Notification, BankExamId = entry.Id,
            FallbackDetails = "Πρότυπο εξάσκησης · Ύλη: " + string.Join(", ", entry.Topics) +
                " · Δυσκολία: " + entry.Difficulty +
                ". Επιλέχθηκε το πλησιέστερο διαθέσιμο πρότυπο. Οι ειδικές οδηγίες δεν εφαρμόζονται στην τοπική τράπεζα."
        };
    }

    private sealed class BankDocument
    {
        public required int SchemaVersion { get; init; }
        public required List<BankEntry> Exams { get; init; }
    }
    private sealed class BankEntry
    {
        public required string Id { get; init; }
        public required List<string> Topics { get; init; }
        public required List<string> Keywords { get; init; }
        public required string Difficulty { get; init; }
        public required ExamJsonResponseDto Exam { get; init; }
    }
}
