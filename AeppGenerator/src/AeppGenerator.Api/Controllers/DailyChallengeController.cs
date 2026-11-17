using AeppGenerator.Api.Auth;
using AeppGenerator.Api.Gamification;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace AeppGenerator.Api.Controllers;

[ApiController, Authorize, Route("api/daily-challenge")]
[ResponseCache(NoStore=true, Location=ResponseCacheLocation.None)]
public sealed class DailyChallengeController(GamificationService service):ControllerBase {
 [HttpGet("today")]
 public ActionResult<DailyChallengeDto> Today()=>Ok(service.Today());

 // Starting is explicit so reading today's questions cannot restart the ten-minute clock.
 [HttpPost("start")]
 public async Task<IActionResult> Start()=>Ok(await service.Start(AuthService.UserId(User)));

 [HttpPost("submit")]
 [RequestSizeLimit(16384)]
 public async Task<IActionResult> Submit(GamificationController.CompleteRequest request) {
  if(request.Answers is null||string.IsNullOrWhiteSpace(request.Day))return BadRequest(new{message="Απαιτούνται ημέρα και απαντήσεις."});
  try{return Ok(await service.Complete(AuthService.UserId(User),request.Day,request.Answers));}
  catch(ArgumentException e){return BadRequest(new{message=e.Message});}
 }
}
