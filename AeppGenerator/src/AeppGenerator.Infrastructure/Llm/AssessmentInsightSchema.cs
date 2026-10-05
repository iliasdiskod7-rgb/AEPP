namespace AeppGenerator.Infrastructure.Llm;

public static class AssessmentInsightSchema
{
    public const string Schema = """
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["summary", "recommendations", "partialCreditSuggestions"],
          "properties": {
            "summary": { "type": "string" },
            "recommendations": { "type": "array", "items": { "type": "string" } },
            "partialCreditSuggestions": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": ["code", "points", "reason"],
                "properties": {
                  "code": { "type": "string" },
                  "points": { "type": "number", "minimum": 0, "maximum": 5 },
                  "reason": { "type": "string" }
                }
              }
            }
          }
        }
        """;
}
