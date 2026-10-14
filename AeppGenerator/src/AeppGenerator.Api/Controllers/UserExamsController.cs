using System.Text.Json;
using AeppGenerator.Application.Llm;
using AeppGenerator.Api.Auth;
using AeppGenerator.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace AeppGenerator.Api.Controllers;
[ApiController,Authorize,Route("api/user-exams")]
public sealed class UserExamsController(AccountStore store):ControllerBase {
 [HttpGet] public IActionResult List()=>Ok(store.Exams(AuthService.UserId(User)));
 [HttpGet("{id}")] public IActionResult Get(string id){var json=store.Exam(AuthService.UserId(User),id);return json is null?NotFound(new{message="Το διαγώνισμα δεν βρέθηκε."}):Content(json,"application/json");}
 [HttpPost,RequestSizeLimit(1000000)]
 public IActionResult Save(JsonElement exam){
  try {
   var model=exam.Deserialize<ExamJsonResponseDto>(new JsonSerializerOptions(JsonSerializerDefaults.Web));
   if(model is null || string.IsNullOrWhiteSpace(model.Title) || model.Title.Length>200 || model.DurationMinutes is <1 or >480 || model.Sections is null || model.Sections.Count!=4 || model.Sections.Any(s=>s is null || string.IsNullOrWhiteSpace(s.Theme) || s.TotalMarks<=0 || s.Questions is null || s.Questions.Count==0 || s.Questions.Any(q=>q is null || string.IsNullOrWhiteSpace(q.Code) || string.IsNullOrWhiteSpace(q.QuestionText) || q.SolutionText is null || q.Marks<=0) || s.Questions.Sum(q=>q.Marks)!=s.TotalMarks) || model.Sections.Sum(s=>s.TotalMarks)!=100) return BadRequest(new{message="Μη έγκυρο διαγώνισμα: απαιτούνται τέσσερα πλήρη θέματα με συνολικά 100 μονάδες."});
   return StatusCode(201,store.SaveExam(AuthService.UserId(User),model.Title,"examJson",exam.GetRawText()));
  }catch(JsonException){return BadRequest(new{message="Μη έγκυρη δομή διαγωνίσματος."});}
 }
}
