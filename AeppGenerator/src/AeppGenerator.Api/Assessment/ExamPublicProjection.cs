using System.Text.Json;
using System.Text.Json.Nodes;

namespace AeppGenerator.Api.Assessment;

public static class ExamPublicProjection
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static JsonElement ForTaking(JsonElement definition)
    {
        var exam = JsonNode.Parse(definition.GetRawText())!.AsObject();
        foreach (var question in exam["sections"]!.AsArray().SelectMany(section => section!["questions"]!.AsArray()).Select(node => node!.AsObject()))
        {
            question["solution"] = "";
            switch (question["kind"]!.GetValue<string>())
            {
                case "trueFalse":
                    foreach (var statement in question["statements"]!.AsArray()) statement!["answer"] = false;
                    break;
                case "matching":
                    var firstChoiceId = question["choices"]![0]!["id"]!.GetValue<string>();
                    foreach (var pair in question["pairs"]!.AsArray()) pair!["rightId"] = firstChoiceId;
                    break;
                case "choice":
                    question["correctId"] = question["options"]![0]!["id"]!.GetValue<string>();
                    break;
                case "fill":
                    question["accepted"] = new JsonArray("__answer_withheld__");
                    break;
                case "codeBlanks":
                    foreach (var blank in question["blanks"]!.AsArray()) blank!["accepted"] = new JsonArray("__answer_withheld__");
                    break;
                case "trace":
                    var rowCount = question["rowLabels"]!.AsArray().Count;
                    var columnCount = question["columns"]!.AsArray().Count;
                    question["expected"] = new JsonArray(Enumerable.Range(0, rowCount)
                        .Select(_ => (JsonNode?)new JsonArray(Enumerable.Range(0, columnCount).Select(_ => (JsonNode?)JsonValue.Create("")).ToArray())).ToArray());
                    break;
                case "program":
                    question["referenceCode"] = "";
                    question["gradingMode"] = "review";
                    question["testCases"] = new JsonArray();
                    break;
            }
        }
        using var publicDocument = JsonDocument.Parse(exam.ToJsonString(Json));
        return publicDocument.RootElement.Clone();
    }
}
