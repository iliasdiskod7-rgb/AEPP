using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text;
using AeppGenerator.Api.Auth;
using AeppGenerator.Api.Data;
using AeppGenerator.Api.Gamification;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace AeppGenerator.Api.Controllers;
[ApiController,Route("api/auth")]
[ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
public sealed class AuthController(AccountStore store,AuthService auth,GamificationService gamification,IWebHostEnvironment environment):ControllerBase {
 private static readonly string DummyHash=BCrypt.Net.BCrypt.HashPassword("dummy-password-not-a-user",12);
 public sealed record RegisterRequest([Required]string Email,[Required]string Password,[Required]string FullName);
 public sealed record LoginRequest([Required]string Email,[Required]string Password);
 [AllowAnonymous,HttpPost("register")]
 public async Task<IActionResult> Register(RegisterRequest r){try{AuthService.ValidateRegistration(r.Email,r.Password,r.FullName);var hash=BCrypt.Net.BCrypt.HashPassword(r.Password,12);var user=await store.Register(r.Email,hash,r.FullName);return StatusCode(201,auth.Issue(user,Response,Request.IsHttps||!environment.IsDevelopment()));}catch(ArgumentException e){return BadRequest(new{message=e.Message});}catch(DuplicateEmailException){return Conflict(new{message="Το email χρησιμοποιείται ήδη."});}}
 [AllowAnonymous,HttpPost("login")]
 public IActionResult Login(LoginRequest r){if(r.Email.Length>254||r.Password.Length>100||Encoding.UTF8.GetByteCount(r.Password)>72)return Unauthorized(new{message="Λανθασμένο email ή κωδικός."});var user=store.FindEmail(r.Email);var valid=BCrypt.Net.BCrypt.Verify(r.Password,user?.PasswordHash??DummyHash);if(user is null||!valid)return Unauthorized(new{message="Λανθασμένο email ή κωδικός."});return Ok(auth.Issue(user,Response,Request.IsHttps||!environment.IsDevelopment()));}
 [Authorize,HttpGet("me")]
 public async Task<IActionResult> Me(){var id=AuthService.UserId(User);var user=store.FindUser(id);if(user is null)return Unauthorized();await gamification.Get(id);return Ok(new{user=AuthService.PublicUser(user),progress=store.Progress(id)});}
 [Authorize,HttpPost("logout")]
 public IActionResult Logout(){store.Revoke(User.FindFirstValue("jti")!,AuthService.UserId(User));Response.Cookies.Delete(AuthService.CookieName,new CookieOptions{Path="/api",Secure=Request.IsHttps||!environment.IsDevelopment(),HttpOnly=true,SameSite=SameSiteMode.Strict});return NoContent();}
}
