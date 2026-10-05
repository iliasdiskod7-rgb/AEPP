using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using AeppGenerator.Application.Abstractions;
using AeppGenerator.Application.Exams;
using AeppGenerator.Application.Llm;
using AeppGenerator.Domain.Enums;
using AeppGenerator.Infrastructure.Prompts;
using Microsoft.AspNetCore.Hosting;
using AeppGenerator.Infrastructure.Llm;
using SectionDto = AeppGenerator.Application.Exams.ExamSectionDto;

namespace AeppGenerator.Infrastructure.Services;

public sealed class LlmExamGeneratorService(
    GeminiClient gemini, IWebHostEnvironment environment)
    : ILlmExamGeneratorService
{
    private static readonly string[] Themes = ["Θέμα Α", "Θέμα Β", "Θέμα Γ", "Θέμα Δ"];
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    public async Task<ExamDto> GenerateExamAsync(GenerateExamRequest request, CancellationToken ct)
    {
        // Η επικύρωση προηγείται της ανάγνωσης αρχείων και της χρεώσιμης κλήσης.
        var userPrompt = GlowSystemPrompts.BuildUserPrompt(request);
        var knowledge = await ReadResourceAsync("KnowledgeBase", "panhellenic_knowledge_base.md", ct);
        var instructions = await ReadResourceAsync("Prompts", "ExamGeneration.el.md", ct);
        var systemPrompt = GlowSystemPrompts.GreekAeppSystemPrompt + "\n\n" + instructions +
            "\n\nΒΑΣΗ ΓΝΩΣΗΣ — εξειδικεύει τη δομή θεμάτων. Οι κανόνες σύνταξης, " +
            "το JSON και η κατανομή μονάδων του αιτήματος παραμένουν υποχρεωτικά.\n" + knowledge;
        userPrompt += $"\n\nΣπόρος παραλλαγής: {Guid.NewGuid():N}. " +
            "Χρησιμοποίησε νέο σενάριο και δεδομένα. Ο σπόρος δεν εμφανίζεται στο διαγώνισμα.";

        var responseBody = await gemini.GenerateAsync(systemPrompt, userPrompt, ct);

        ExamJsonResponseDto generated;
        try
        {
            using var body = JsonDocument.Parse(responseBody);
            var candidate = body.RootElement.GetProperty("candidates")[0];
            if (!string.Equals(candidate.GetProperty("finishReason").GetString(), "STOP",
                    StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("Το μοντέλο δεν επέστρεψε ολοκληρωμένο διαγώνισμα.");
            var parts = candidate.GetProperty("content").GetProperty("parts");
            var json = string.Concat(parts.EnumerateArray()
                .Where(part => part.TryGetProperty("text", out _) &&
                    !(part.TryGetProperty("thought", out var thought) && thought.ValueKind == JsonValueKind.True))
                .Select(part => part.GetProperty("text").GetString()));
            generated = JsonSerializer.Deserialize<ExamJsonResponseDto>(
                json, JsonOptions)
                ?? throw new InvalidDataException("Η απόκριση του μοντέλου είναι κενή.");
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or
                                   InvalidOperationException or IndexOutOfRangeException)
        {
            throw new InvalidDataException("Η απόκριση του μοντέλου δεν έχει την απαιτούμενη μορφή.", ex);
        }

        ValidateResponse(generated, request);
        return MapExam(generated, request);
    }

    public async Task<ExamDto> GenerateExamAsync(GenerateExamCommand command, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(command);
        var request = new GenerateExamRequest
        {
            TargetTopics = [command.TargetTopic],
            Difficulty = command.Difficulty switch
            {
                Difficulty.Easy => "Εύκολο",
                Difficulty.Medium => "Μεσαίο",
                Difficulty.Hard => "Αυξημένης Δυσκολίας",
                _ => throw new ArgumentException("Μη έγκυρη δυσκολία.")
            }
        };
        var exam = await GenerateExamAsync(request, ct);
        return exam with { Title = command.Title, AcademicYear = command.AcademicYear };
    }

    private async Task<string> ReadResourceAsync(string directory, string name, CancellationToken ct)
    {
        // ContentRoot για φιλοξενία, output directory για dotnet run και publish.
        var path = Path.Combine(environment.ContentRootPath, directory, name);
        if (!File.Exists(path)) path = Path.Combine(AppContext.BaseDirectory, directory, name);
        var content = await File.ReadAllTextAsync(path, Encoding.UTF8, ct);
        if (string.IsNullOrWhiteSpace(content))
            throw new InvalidDataException($"Το αρχείο {directory}/{name} είναι κενό.");
        return content;
    }

    private static void ValidateResponse(ExamJsonResponseDto exam, GenerateExamRequest request)
    {
        var selected = Themes.Where(request.IncludeThemes.Contains).ToArray();
        if (string.IsNullOrWhiteSpace(exam.Title) || exam.DurationMinutes != 180 ||
            exam.Sections is null || exam.Sections.Count != selected.Length)
            throw new InvalidDataException("Μη έγκυρος τίτλος, διάρκεια ή πλήθος θεμάτων.");

        var codes = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < selected.Length; i++)
        {
            var section = exam.Sections[i];
            var marks = 100 / selected.Length + (i < 100 % selected.Length ? 1 : 0);
            if (section is null || section.Theme != selected[i] || section.TotalMarks != marks ||
                section.Questions is null || section.Questions.Count == 0)
                throw new InvalidDataException("Τα θέματα ή η κατανομή μονάδων δεν συμφωνούν με το αίτημα.");
            long sum = 0;
            foreach (var question in section.Questions)
            {
                if (question is null || string.IsNullOrWhiteSpace(question.Code) ||
                    !Regex.IsMatch(question.Code, $"^{section.Theme[^1]}[1-9][0-9]*$", RegexOptions.CultureInvariant) ||
                    !codes.Add(question.Code) || string.IsNullOrWhiteSpace(question.QuestionText) ||
                    string.IsNullOrWhiteSpace(question.SolutionText) || question.Marks is < 1 or > 100)
                    throw new InvalidDataException("Μη έγκυρος κωδικός, εκφώνηση, λύση ή μονάδες ερωτήματος.");
                sum += question.Marks;
            }
            if (sum != marks)
                throw new InvalidDataException("Το άθροισμα των μονάδων των ερωτημάτων είναι λανθασμένο.");
        }
    }

    private static ExamDto MapExam(ExamJsonResponseDto source, GenerateExamRequest request)
    {
        var now = DateTime.UtcNow;
        var year = now.Month >= 9 ? now.Year : now.Year - 1;
        var id = Guid.NewGuid();
        var sections = source.Sections.Select(section =>
        {
            var sectionId = Guid.NewGuid();
            return new SectionDto(sectionId, id, (SectionType)Array.IndexOf(Themes, section.Theme),
                section.Theme, section.TotalMarks, section.Questions.Select((question, index) =>
                    new QuestionItemDto(Guid.NewGuid(), sectionId, index + 1, question.Code,
                        question.QuestionText + (string.IsNullOrWhiteSpace(question.GlowCodeSnippet)
                            ? "" : "\n\n```glossa\n" + question.GlowCodeSnippet + "\n```"),
                        question.SolutionText, question.Marks, null)).ToList());
        }).ToList();
        return new ExamDto(id, source.Title, $"{year}-{year + 1}", string.Join(", ", request.TargetTopics),
            request.Difficulty switch
            {
                "Εύκολο" => Difficulty.Easy,
                "Αυξημένης Δυσκολίας" => Difficulty.Hard,
                _ => Difficulty.Medium
            }, now, sections, source.DurationMinutes);
    }
}
