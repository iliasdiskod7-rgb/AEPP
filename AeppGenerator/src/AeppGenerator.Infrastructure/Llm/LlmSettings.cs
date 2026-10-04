namespace AeppGenerator.Infrastructure.Llm;

public class LlmSettings
{
    public const string SectionName = "LlmSettings";

    public string Provider { get; set; } = "Gemini";
    public string Model { get; set; } = "gemini-1.5-pro";
    public string ApiKey { get; set; } = string.Empty;
}