using AeppGenerator.Api.Gamification;
using AeppGenerator.Api.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace AeppGenerator.Api.Controllers;
[ApiController,Authorize]
[ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
[Route("api/gamification")]
public sealed class GamificationController(GamificationService service):ControllerBase {
 private string Identity()=>AuthService.UserId(User);
 private async Task<IActionResult> Execute(Func<string,Task<object>> action){try{return Ok(await action(Identity()));}catch(ArgumentException e){return BadRequest(new{message=e.Message});}}
 [HttpGet] public Task<IActionResult> Get()=>Execute(service.Get);
 [HttpPost("start")] public Task<IActionResult> Start()=>Execute(service.Start);
 [HttpPost("theory")] public Task<IActionResult> Theory(TheoryRequest r)=>Execute(id=>service.Theory(id,r.Day,r.Answer));
 [HttpPost("complete")] public Task<IActionResult> Complete(CompleteRequest r)=>Execute(id=>service.Complete(id,r.Day,r.Answers));
 [HttpPost("study")] public Task<IActionResult> Study(StudyRequest r)=>Execute(id=>service.Study(id,r.LessonId));
 [HttpPost("freeze")] public Task<IActionResult> Freeze()=>Execute(service.Freeze);
 [HttpPut("profile")] public Task<IActionResult> Profile(ProfileRequest r)=>Execute(id=>service.Update(id,r.Username,r.Avatar,r.Group,r.Friends));
 [HttpGet("leaderboard")] public async Task<IActionResult> Leaderboard(string period="weekly",string scope="national",int page=1,int pageSize=20){try{return Ok(await service.RankingPage(Identity(),period,scope,page,pageSize));}catch(ArgumentException e){return BadRequest(new{message=e.Message});}}
 public sealed record TheoryRequest(string Day,string Answer);
 public sealed record CompleteRequest(string Day,Dictionary<string,string> Answers);
 public sealed record StudyRequest(string LessonId);
 public sealed record ProfileRequest(string Username,string Avatar,string Group,string[] Friends);
}
