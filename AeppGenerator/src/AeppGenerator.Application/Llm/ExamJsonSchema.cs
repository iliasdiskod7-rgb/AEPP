namespace AeppGenerator.Application.Llm;

/// <summary>
/// Σχήμα για δομημένη έξοδο. Τα αθροίσματα μονάδων και η ορθότητα της ΓΛΩΣΣΑΣ
/// απαιτούν επιπλέον έλεγχο στην υλοποίηση της υπηρεσίας.
/// </summary>
public static class ExamJsonSchema
{
    public const string Schema = """
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["title", "durationMinutes", "sections"],
          "properties": {
            "title": { "type": "string" },
            "durationMinutes": { "type": "integer", "minimum": 1 },
            "sections": {
              "type": "array",
              "minItems": 1,
              "maxItems": 4,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": ["theme", "totalMarks", "questions"],
                "properties": {
                  "theme": {
                    "type": "string",
                    "enum": ["Θέμα Α", "Θέμα Β", "Θέμα Γ", "Θέμα Δ"]
                  },
                  "totalMarks": { "type": "integer", "minimum": 1, "maximum": 100 },
                  "questions": {
                    "type": "array",
                    "minItems": 1,
                    "items": {
                      "type": "object",
                      "additionalProperties": false,
                      "required": ["code", "questionText", "glowCodeSnippet", "solutionText", "marks"],
                      "properties": {
                        "code": { "type": "string" },
                        "questionText": { "type": "string" },
                        "glowCodeSnippet": { "type": ["string", "null"] },
                        "solutionText": { "type": "string" },
                        "marks": { "type": "integer", "minimum": 1, "maximum": 100 }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        """;
}
