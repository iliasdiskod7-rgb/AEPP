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
    private readonly string[] bankIds;
    public string PracticeId { get; }
    public ExamCatalog()
    {
        using var stream = typeof(ExamCatalog).Assembly.GetManifestResourceStream("AeppGenerator.PracticeExam")!;
        using var reader = new StreamReader(stream);
        practiceJson = reader.ReadToEnd();
        var definitions = JsonNode.Parse(practiceJson)!.AsArray();
        foreach (var definition in definitions) Validate(definition!.AsObject());
        bankIds = definitions.Select(d => d!["id"]!.GetValue<string>()).ToArray();
        PracticeId = bankIds[0];
    }

    public async Task Seed(AssessmentDbContext db, CancellationToken ct)
    {
        await ExamDbInitializer.SeedAsync(db, practiceJson, ct);
    }

    public async Task<RandomExamResponse?> GetRandomPracticeExam(AssessmentDbContext db, CancellationToken ct, string? excludeId = null)
    {
        var ids = bankIds;
        var exams = await db.Exams.AsNoTracking().Where(exam => exam.Source == "practice" && ids.Contains(exam.Id)).ToListAsync(ct);
        if (exams.Count == 0) { await Seed(db, ct); exams = await db.Exams.AsNoTracking().Where(exam => exam.Source == "practice" && ids.Contains(exam.Id)).ToListAsync(ct); }
        if (exams.Count == 0) return null;
        var candidates = exams.Where(exam => exam.Id != excludeId).ToList();
        if (candidates.Count == 0) candidates = exams;
        var selected = candidates[Random.Shared.Next(candidates.Count)];
        using var definition = JsonDocument.Parse(selected.DefinitionJson);
        var hiddenTestCases = definition.RootElement.GetProperty("sections").EnumerateArray()
            .SelectMany(section => section.GetProperty("questions").EnumerateArray())
            .Where(question => question.TryGetProperty("testCases", out _))
            .Sum(question => question.GetProperty("testCases").GetArrayLength());
        return new(selected.Id, selected.Title, ExamPublicProjection.ForTaking(definition.RootElement), hiddenTestCases);
    }

    public async Task<List<RandomExamResponse>> ListPracticeExams(AssessmentDbContext db, CancellationToken ct)
    {
        await Seed(db, ct);
        var ids = bankIds;
        var exams = await db.Exams.AsNoTracking().Where(e => ids.Contains(e.Id) && e.Source == "practice").OrderBy(e => e.Id).ToListAsync(ct);
        return exams.Select(e => { using var doc = JsonDocument.Parse(e.DefinitionJson); return new RandomExamResponse(e.Id, e.Title, ExamPublicProjection.ForTaking(doc.RootElement), 0); }).ToList();
    }

    public async Task<Exam> Resolve(AssessmentDbContext db, StartAttemptRequest request, string userId, CancellationToken ct)
    {
        if (request.GeneratedExam is not null)
            throw new ArgumentException("Η δημόσια έκδοση διαθέτει μόνο έτοιμα διαγωνίσματα εξάσκησης.");
        var ids = bankIds;
        return await db.Exams.SingleOrDefaultAsync(exam => exam.Id == request.ExamId && exam.Source == "practice" && ids.Contains(exam.Id), ct)
            ?? throw new AttemptNotFoundException();
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
