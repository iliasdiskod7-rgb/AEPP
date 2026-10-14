using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using AeppGenerator.Api.Auth;
using AeppGenerator.Api.Controllers;
using AeppGenerator.Api.Data;
using AeppGenerator.Api.Security;
using AeppGenerator.Application.Abstractions;
using AeppGenerator.Application.Exams;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;

var directory = Path.Combine(Path.GetTempPath(), "aepp-security-" + Guid.NewGuid());
Directory.CreateDirectory(directory);
var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Configuration["Accounts:DatabasePath"] = Path.Combine(directory, "accounts.sqlite");
builder.Configuration["Auth:SigningKey"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
builder.WebHost.UseUrls("http://127.0.0.1:0");
builder.AddAccounts();
builder.Services.AddRateLimiter(ApiRateLimiting.Configure);
var fake = new FakeInsights();
builder.Services.AddSingleton<IAssessmentInsightService>(fake);
builder.Services.AddControllers().AddApplicationPart(typeof(AssessmentInsightsController).Assembly);
await using var app = builder.Build();
app.UseRouting();
app.UseAccountOriginGuard();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();
app.MapGet("/probe", () => Results.Ok());
app.MapGet("/other", () => Results.Ok());
await app.StartAsync();
using var client = new HttpClient(new HttpClientHandler { UseCookies = false }) { BaseAddress = new Uri(app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single()), Timeout = TimeSpan.FromSeconds(15) };
int checks = 0;
void Check(bool condition, string label) { if (!condition) throw new Exception(label); Console.WriteLine("PASS " + label); checks++; }
async Task<string> Token(string email) {
 var user = await app.Services.GetRequiredService<AccountStore>().Register(email, "test-only", "Μαθητής");
 return Issue(user);
}
string Issue(AccountUser user) {
 var issued = app.Services.GetRequiredService<AuthService>().Issue(user, new DefaultHttpContext().Response, false);
 return JsonSerializer.SerializeToElement(issued).GetProperty("token").GetString()!;
}
Task<HttpResponseMessage> Insight(string? token, string code = "normal", CancellationToken ct = default) {
 var request = new HttpRequestMessage(HttpMethod.Post, "/api/exams/assessment-insight");
 if (token != null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
 request.Content = JsonContent.Create(new AssessmentInsightRequest([new(code, "", 0, 1, "", null, null, null)]));
 return client.SendAsync(request, ct);
}
async Task Rejected(HttpResponseMessage response, string label) {
 Check(response.StatusCode == HttpStatusCode.TooManyRequests, label);
 Check((await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString() == ApiRateLimiting.RejectionMessage, label + " JSON");
 Check(response.Headers.RetryAfter?.Delta >= TimeSpan.FromSeconds(1), label + " Retry-After");
}
try {
 Check((await Insight(null)).StatusCode == HttpStatusCode.Unauthorized, "anonymous 401");
 Check((await Insight("invalid")).StatusCode == HttpStatusCode.Unauthorized, "invalid JWT 401");
 Check(fake.Calls == 0, "unauthorized never invokes AI");
 var first = await Token("first@example.test");
 for (var i = 0; i < 5; i++) Check((await Insight(first)).IsSuccessStatusCode, "user allowance " + (i+1));
 await Rejected(await Insight(first), "sixth request");
 var same = Issue(app.Services.GetRequiredService<AccountStore>().FindEmail("first@example.test")!);
 await Rejected(await Insight(same), "new session same user");
 Check((await Insight(null)).StatusCode == HttpStatusCode.Unauthorized, "401 after exhausted quota");
 var second = await Token("second@example.test");
 fake.Hold = true;
 var pending1 = Insight(second); var pending2 = Insight(second);
 await fake.TwoStarted.Task.WaitAsync(TimeSpan.FromSeconds(10));
 await Rejected(await Insight(second), "third concurrent request");
 var third = await Token("third@example.test");
 Check((await Insight(third, "bypass")).IsSuccessStatusCode, "independent user concurrency");
 fake.Hold = false; fake.Release.TrySetResult();
 Check((await pending1).IsSuccessStatusCode && (await pending2).IsSuccessStatusCode, "two admitted requests finish");
 Check((await Insight(second)).IsSuccessStatusCode, "concurrency leases released");
 Check((await Insight(second, "fail")).StatusCode == HttpStatusCode.BadRequest, "controller failure");
 Check((await Insight(second)).IsSuccessStatusCode, "lease released after failure");
 for(var i=0;i<120;i++) { using var r=await client.GetAsync(i%2==0 ? "/probe" : "/other"); if(!r.IsSuccessStatusCode) throw new Exception("IP allowance " + i); }
 await Rejected(await client.GetAsync("/other"), "shared global IP budget");
 Check((await Insight(third)).IsSuccessStatusCode, "AI isolated from general IP budget");
 Console.WriteLine(checks + " security checks passed.");
} finally { await app.StopAsync(); }

sealed class FakeInsights : IAssessmentInsightService {
 public int Calls;
 public bool Hold;
 private int held;
 public TaskCompletionSource TwoStarted = new(TaskCreationOptions.RunContinuationsAsynchronously);
 public TaskCompletionSource Release = new(TaskCreationOptions.RunContinuationsAsynchronously);
 public async Task<AssessmentInsightResponse> GenerateAsync(AssessmentInsightRequest request, CancellationToken ct) {
 Interlocked.Increment(ref Calls);
 var code=request.Items[0].Code;
 if(code=="fail") throw new ArgumentException("Δοκιμή");
 if(Hold && code != "bypass") { if(Interlocked.Increment(ref held)==2) TwoStarted.TrySetResult(); await Release.Task.WaitAsync(ct); }
 return new("Δοκιμή", [], []);
 }
}
