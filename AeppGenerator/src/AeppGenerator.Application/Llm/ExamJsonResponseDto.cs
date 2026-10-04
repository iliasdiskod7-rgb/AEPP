using System.Text.Json.Serialization;

namespace AeppGenerator.Application.Llm;

/// <summary>Δομημένη απόκριση του μοντέλου, πριν από τη μετατροπή σε οντότητες.</summary>
public sealed class ExamJsonResponseDto
{
    [JsonPropertyName("title")]
    public required string Title { get; init; }

    [JsonPropertyName("durationMinutes")]
    public required int DurationMinutes { get; init; }

    [JsonPropertyName("sections")]
    public required List<ExamSectionDto> Sections { get; init; }
}

/// <summary>Θέμα με ελληνικό τίτλο, μονάδες και ερωτήματα.</summary>
public sealed class ExamSectionDto
{
    [JsonPropertyName("theme")]
    public required string Theme { get; init; }

    [JsonPropertyName("totalMarks")]
    public required int TotalMarks { get; init; }

    [JsonPropertyName("questions")]
    public required List<QuestionDto> Questions { get; init; }
}

/// <summary>Εκφώνηση, προαιρετικός κώδικας ΓΛΩΣΣΑΣ και αναλυτική λύση.</summary>
public sealed class QuestionDto
{
    [JsonPropertyName("code")]
    public required string Code { get; init; }

    [JsonPropertyName("questionText")]
    public required string QuestionText { get; init; }

    // Το πεδίο υπάρχει πάντα στο JSON· χωρίς κώδικα έχει τιμή null.
    [JsonPropertyName("glowCodeSnippet")]
    public required string? GlowCodeSnippet { get; init; }

    [JsonPropertyName("solutionText")]
    public required string SolutionText { get; init; }

    [JsonPropertyName("marks")]
    public required int Marks { get; init; }
}
