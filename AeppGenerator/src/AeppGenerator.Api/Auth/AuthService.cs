using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using AeppGenerator.Api.Data;
using Microsoft.IdentityModel.Tokens;
namespace AeppGenerator.Api.Auth;
public sealed class AuthService(AccountStore store,IConfiguration config,IWebHostEnvironment environment) {
 public const string CookieName="aepp-access";
 public string Issuer {get;}=config["Auth:Issuer"]??"AeppGenerator";
 public string Audience {get;}=config["Auth:Audience"]??"AeppClient";
 public byte[] Key {get;}=LoadKey(config,environment);
 public static string UserId(ClaimsPrincipal user)=>user.FindFirstValue("sub")??throw new UnauthorizedAccessException();
 private static byte[] LoadKey(IConfiguration config,IWebHostEnvironment env){var value=config["Auth:SigningKey"];if(!string.IsNullOrWhiteSpace(value)){var key=Convert.FromBase64String(value);if(key.Length<32)throw new InvalidOperationException("Το Auth:SigningKey απαιτεί τουλάχιστον 32 τυχαία bytes σε Base64.");return key;}if(!env.IsDevelopment())throw new InvalidOperationException("Ρύθμισε το Auth:SigningKey πριν την εκκίνηση.");var folder=Path.Combine(env.ContentRootPath,"App_Data");Directory.CreateDirectory(folder);var path=Path.Combine(folder,"auth-signing.key");if(!File.Exists(path))File.WriteAllBytes(path,RandomNumberGenerator.GetBytes(32));return File.ReadAllBytes(path);}
 public object Issue(AccountUser user,HttpResponse response,bool secure){var now=DateTimeOffset.UtcNow;var expires=now.AddHours(1);var session=Guid.NewGuid().ToString("N");var claims=new[]{new Claim("sub",user.Id),new Claim("jti",session),new Claim("name",user.FullName),new Claim("role",user.Role)};var jwt=new JwtSecurityToken(Issuer,Audience,claims,now.UtcDateTime,expires.UtcDateTime,new SigningCredentials(new SymmetricSecurityKey(Key),SecurityAlgorithms.HmacSha256));var token=new JwtSecurityTokenHandler().WriteToken(jwt);store.AddSession(session,user.Id,expires.ToUnixTimeSeconds());response.Cookies.Append(CookieName,token,new CookieOptions{HttpOnly=true,Secure=secure,SameSite=SameSiteMode.Strict,Expires=expires,Path="/api",IsEssential=true});return new{token,expiresAt=expires,user=PublicUser(user),progress=store.Progress(user.Id)};}
 public static object PublicUser(AccountUser user)=>new{user.Id,user.Email,user.FullName,user.Role,user.CreatedAt};
 public static void ValidateRegistration(string email,string password,string name){if(!System.Net.Mail.MailAddress.TryCreate(email,out var address)||address.Address!=email.Trim()||email.Length>254)throw new ArgumentException("Δώσε έγκυρο email.");if(password.Length<10||Encoding.UTF8.GetByteCount(password)>72)throw new ArgumentException("Ο κωδικός απαιτεί τουλάχιστον 10 χαρακτήρες και έως 72 bytes UTF-8.");if(name.Trim().Length is <2 or >100||name.Any(char.IsControl))throw new ArgumentException("Το ονοματεπώνυμο απαιτεί 2–100 χαρακτήρες.");}
}
