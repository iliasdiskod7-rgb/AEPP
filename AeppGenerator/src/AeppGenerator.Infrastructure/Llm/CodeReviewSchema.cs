namespace AeppGenerator.Infrastructure.Llm;

public static class CodeReviewSchema
{
    public const string Schema = """
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["efficiency", "algorithmicRisks", "styleAndAeppRules"],
          "properties": {
            "efficiency": { "type": "string" },
            "algorithmicRisks": { "type": "string" },
            "styleAndAeppRules": { "type": "string" }
          }
        }
        """;
}
