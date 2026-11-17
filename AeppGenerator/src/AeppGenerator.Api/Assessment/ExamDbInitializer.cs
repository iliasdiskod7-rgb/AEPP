using System.Text.Json.Nodes;
using AeppGenerator.Api.Data;
using Microsoft.EntityFrameworkCore;
namespace AeppGenerator.Api.Assessment;

/// <summary>Seeds only the five authored exams; reset is an explicit backed-up operation.</summary>
public static class ExamDbInitializer
{
 public static async Task SeedAsync(AssessmentDbContext db, string bankJson, CancellationToken ct)
 {
  var definitions = JsonNode.Parse(bankJson)!.AsArray();
  foreach (var definition in definitions)
  {
   var id = definition!["id"]!.GetValue<string>();
   var existing = await db.Exams.SingleOrDefaultAsync(e => e.Id == id, ct);
   if (existing is not null)
   {
    // Targeted editorial correction; stored submissions and reports remain intact.
    if (id == "aepp-2026-01")
    {
     var saved = JsonNode.Parse(existing.DefinitionJson);
     var savedQuestions = saved?["sections"]?.AsArray().ElementAtOrDefault(1)?["questions"]?.AsArray();
     var currentQuestions = definition["sections"]![1]!["questions"]!.AsArray();
     if (savedQuestions is not null)
     {
      for (var index = 0; index < savedQuestions.Count; index++)
      {
       var question = savedQuestions[index];
       var questionId = question?["id"]?.GetValue<string>();
       var oldIncrement = question?["prompt"]?.GetValue<string>().Contains("i <- i + (1)", StringComparison.Ordinal) == true;
       var redundantOutput = questionId == "b3" && question?["columns"]?.AsArray().Any(column => column?.GetValue<string>() == "ΕΞΟΔΟΣ") == true;
       if ((questionId is "b2a" or "b2b") && oldIncrement || redundantOutput)
        savedQuestions[index] = currentQuestions.Single(item => item!["id"]!.GetValue<string>() == questionId)!.DeepClone();
      }
      var savedDelta = saved?["sections"]?.AsArray().ElementAtOrDefault(3)?["questions"]?.AsArray().FirstOrDefault(q => q?["id"]?.GetValue<string>() == "d1");
      var currentDelta = definition["sections"]![3]!["questions"]!.AsArray().Single(q => q!["id"]!.GetValue<string>() == "d1")!;
      if (savedDelta is not null)
      {
       savedDelta["prompt"] = currentDelta["prompt"]!.DeepClone();
       savedDelta["subquestions"] = currentDelta["subquestions"]!.DeepClone();
      }
      existing.DefinitionJson = saved!.ToJsonString();
     }
    }
    continue;
   }
   db.Exams.Add(new Exam { Id=id, Title=definition["title"]!.GetValue<string>(), Source="practice", DefinitionJson=definition.ToJsonString(), CreatedAt=DateTime.UtcNow });
  }
  await db.SaveChangesAsync(ct);
 }
}
