using AeppGenerator.Api.Auth;
using AeppGenerator.Api.Gamification;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace AeppGenerator.Api.Controllers;
[ApiController,Authorize,Route("api/daily-challenge")]
public sealed class DailyChallengeController(GamificationService service):ControllerBase {
 [HttpPost("submit")]
 public async Task<IActionResult> Submit(GamificationController.CompleteRequest request){try{return Ok(await service.Complete(AuthService.UserId(User),request.Day,request.Answers));}catch(ArgumentException e){return BadRequest(new{message=e.Message});}}
}
