namespace AeppGenerator.Infrastructure.Llm;

public class LlmSettings
{
    public const string SectionName = "LlmSettings";

    public string Provider { get; set; } = "Gemini";
    public string Model { get; set; } = "gemini-3.8-flash";
    public string ApiKey { get; set; } = string.Empty;
    public string[] FallbackModels { get; set; } = ["gemini-3.5-flash"];
    public int MaxRounds { get; set; } = 2;
    public int AttemptTimeoutSeconds { get; set; } = 90;
    public int TotalTimeoutSeconds { get; set; } = 240;
    public int MaxOutputTokens { get; set; } = 32768;
}
