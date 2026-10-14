using AeppGenerator.Api.Auth;
using AeppGenerator.Api.Gamification;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace AeppGenerator.Api.Controllers;
[ApiController,Authorize]
[ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
[Route("api/leaderboard")]
public sealed class LeaderboardController(GamificationService service):ControllerBase
{
 [HttpGet]
 public async Task<IActionResult> Get(int page=1,int pageSize=20,string period="all",string scope="national")
 {
  try { return Ok(await service.RankingPage(AuthService.UserId(User),period,scope,page,pageSize)); }
  catch(ArgumentException error) { return BadRequest(new{message=error.Message}); }
 }
}
