using System.Text.Json.Serialization;

namespace AeppGenerator.Application.Llm;

/// <summary>Οι επιλογές του καθηγητή για την παραγωγή διαγωνίσματος.</summary>
public sealed class GenerateExamRequest
{
    [JsonPropertyName("targetTopics")]
    public List<string> TargetTopics { get; init; } = [];

    [JsonPropertyName("difficulty")]
    public string Difficulty { get; init; } = "Μεσαίο";

    [JsonPropertyName("includeThemes")]
    public List<string> IncludeThemes { get; init; } =
        ["Θέμα Α", "Θέμα Β", "Θέμα Γ", "Θέμα Δ"];

    [JsonPropertyName("customInstructions")]
    public string? CustomInstructions { get; init; }
}
