using System.Diagnostics;
using System.Net;
using System.Text;
using System.Text.Json;
using AeppGenerator.Api.Controllers;
using AeppGenerator.Api.Data;
using System.Security.Claims;
using AeppGenerator.Application.Exams;
using AeppGenerator.Application.Llm;
using AeppGenerator.Infrastructure.Llm;
using AeppGenerator.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

var sourceRoot = Path.GetFullPath(args.FirstOrDefault(x => x.StartsWith("--source="))?[9..]
    ?? "src/AeppGenerator.Infrastructure");
var request = new GenerateExamRequest { TargetTopics = ["Πίνακες", "Υποπρογράμματα", "Δομές Επανάληψης"] };
var fixture = new
{
    title = "Δοκιμαστικό διαγώνισμα", durationMinutes = 180,
    sections = new[] { "Α", "Β", "Γ", "Δ" }.Select(letter => new
    {
        theme = "Θέμα " + letter, totalMarks = 25,
        questions = new[] { new { code = letter + "1", questionText = "Ερώτημα δοκιμής", glowCodeSnippet = (string?)null,
            solutionText = "Λύση δοκιμής", marks = 25 } }
    })
};
var valid = JsonSerializer.Serialize(new
{
    candidates = new[] { new { finishReason = "STOP", content = new { parts = new[] { new { text = JsonSerializer.Serialize(fixture) } } } } }
});
using var logs = LoggerFactory.Create(builder => builder.AddSimpleConsole(o => o.SingleLine = true));
var settings = new LlmSettings { ApiKey = "test-only", Model = "primary", FallbackModels = ["fallback"], MaxRounds = 1 };
var accounts = new AccountStore(Path.Combine(Directory.GetCurrentDirectory(), ".tmp", "review-checks-" + Guid.NewGuid().ToString("N"), "accounts.sqlite"));
var testUser = await accounts.Register("checks@example.test", "test-only-not-a-login", "Δοκιμαστικός καθηγητής");
accounts.PromoteTeacher(testUser.Email);
var testIdentity = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", testUser.Id), new Claim("role", "TEACHER")], "checks", "name", "role"));

HttpClient Client(HttpMessageHandler handler) => new(handler)
    { BaseAddress = new Uri("https://generativelanguage.googleapis.com/"), Timeout = Timeout.InfiniteTimeSpan };
ExamsController Controller(HttpClient http, LlmSettings config, LlmRetryHandler? handler = null) => new(
    new FallbackExamGeneratorService(
        new LlmExamGeneratorService(new GeminiClient(http, Options.Create(config), logs.CreateLogger<GeminiClient>(),
            handler ?? new LlmRetryHandler((_, token) => { token.ThrowIfCancellationRequested(); return Task.CompletedTask; })),
            new TestEnvironment(sourceRoot)), new LocalExamBank(), logs.CreateLogger<FallbackExamGeneratorService>()), accounts) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = testIdentity } } };
void Check(bool condition, string name) { if (!condition) throw new Exception("FAILED: " + name); Console.WriteLine("PASS: " + name); }
HttpResponseMessage Reply(int status, string body = "{}") => new((HttpStatusCode)status) { Content = new StringContent(body) };

if (args.Contains("--live") || args.Contains("--live-node"))
{
    var configFile = Path.Combine(sourceRoot, "../AeppGenerator.Api/appsettings.json");
    using var config = JsonDocument.Parse(await File.ReadAllTextAsync(configFile));
    var liveSettings = JsonSerializer.Deserialize<LlmSettings>(config.RootElement.GetProperty("LlmSettings"))!;
    var secretPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "Microsoft/UserSecrets/AeppGenerator.Api-LocalDevelopment/secrets.json");
    using var secrets = JsonDocument.Parse(await File.ReadAllTextAsync(secretPath));
    liveSettings.ApiKey = secrets.RootElement.GetProperty("LlmSettings:ApiKey").GetString()!;
    using var http = Client(args.Contains("--live-node") ? new NodeTlsHandler() : new HttpClientHandler());
    var result = await Controller(http, liveSettings).Generate(request, default);
    if (result.Result is not OkObjectResult { Value: ExamDto exam })
    {
        var problem = (result.Result as ObjectResult)?.Value as ProblemDetails;
        throw new Exception($"Live request failed: {problem?.Status}: {problem?.Detail ?? problem?.Title}");
    }
    Check(exam.Sections.Count == 4 && exam.Sections.Sum(x => x.TotalMarks) == 100, "live full exam, 4 themes / 100 marks");
    await File.WriteAllTextAsync(Path.Combine(AppContext.BaseDirectory, "live-exam.json"), JsonSerializer.Serialize(exam, new JsonSerializerOptions { WriteIndented = true }));
    Console.WriteLine($"Title: {exam.Title}; Questions: {exam.Sections.Sum(x => x.Questions.Count)}");
    return;
}

var waits = new List<TimeSpan>();
var retry = new LlmRetryHandler((wait, token) => { token.ThrowIfCancellationRequested(); waits.Add(wait); return Task.CompletedTask; });
var retryCalls = 0;
try
{
    await retry.ExecuteAsync<string>(_ => { retryCalls++; throw new HttpRequestException("test", null, HttpStatusCode.TooManyRequests); }, default);
    throw new Exception("Failure swallowed");
}
catch (HttpRequestException) { }
Check(retryCalls == 3 && waits.SequenceEqual(new[] { TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(4) }), "two retries, exponential delays 2s / 4s");
waits.Clear(); retryCalls = 0;
var recovered = await retry.ExecuteAsync(_ => ++retryCalls == 1
    ? Task.FromException<string>(new LlmTransientException(HttpStatusCode.ServiceUnavailable, TimeSpan.FromSeconds(7)))
    : Task.FromResult("ok"), default);
Check(recovered == "ok" && waits.Single() == TimeSpan.FromSeconds(7), "Retry-After respected");

foreach (var status in new[] { 429, 503, 408, 500, 502, 504 })
{
    var attempts = 0;
    using var http = Client(new Stub((_, _) => { attempts++; return Task.FromResult(Reply(status)); }));
    var result = await Controller(http, settings).Generate(request, default);
    Check(result.Result is OkObjectResult { Value: ExamDto { GenerationSource: "examBank", Sections.Count: 4 } exam }
        && exam.Sections.Sum(s => s.TotalMarks) == 100 && exam.FallbackMessage == LocalExamBank.Notification && attempts == 3,
        $"provider {status} -> 3 attempts -> local exam / HTTP 200");
}
foreach (var status in new[] { 400, 401, 403, 404 })
{
    var attempts = 0;
    using var http = Client(new Stub((_, _) => { attempts++; return Task.FromResult(Reply(status)); }));
    var result = await Controller(http, settings).Generate(request, default);
    Check(result.Result is ObjectResult { StatusCode: 502 } && attempts == 1, $"permanent {status}: no retry/fallback");
}
foreach (var firstStatus in new[] { 429, 503 })
{
    var attempts = 0;
    using var http = Client(new Stub((_, _) => Task.FromResult(++attempts < 3 ? Reply(firstStatus) : Reply(200, valid))));
    var result = await Controller(http, settings).Generate(request, default);
    Check(result.Result is OkObjectResult { Value: ExamDto { GenerationSource: "ai", FallbackMessage: null } } && attempts == 3,
        $"recovery after {firstStatus}: AI result, no fallback notification");
}
using (var http = Client(new Stub((_, _) => throw new HttpRequestException("network"))))
{
    Check((await Controller(http, settings).Generate(request, default)).Result is OkObjectResult { Value: ExamDto { GenerationSource: "examBank" } }, "network failure -> bank");
}
using (var http = Client(new Stub((_, _) => Task.FromResult(Reply(200, "{}")))))
{
    Check((await Controller(http, settings).Generate(request, default)).Result is ObjectResult { StatusCode: 502 }, "malformed response rejected");
}
using (var http = Client(new Stub(async (_, token) => { await Task.Delay(Timeout.InfiniteTimeSpan, token); return Reply(200); })))
{
    var budget = new LlmSettings { ApiKey = "test", Model = "primary", TotalTimeoutSeconds = 1 };
    Check((await Controller(http, budget).Generate(request, default)).Result is OkObjectResult { Value: ExamDto { GenerationSource: "examBank" } }, "total timeout -> bank");
    using var cancel = new CancellationTokenSource(); cancel.Cancel();
    try { await Controller(http, settings).Generate(request, cancel.Token); throw new Exception("Cancellation swallowed"); }
    catch (OperationCanceledException) { Console.WriteLine("PASS: caller cancellation propagated"); }
}
var timeoutAttempts = 0;
using (var http = Client(new Stub((_, _) => { timeoutAttempts++; throw new TaskCanceledException("attempt timeout"); })))
{
    Check((await Controller(http, settings).Generate(request, default)).Result is OkObjectResult { Value: ExamDto { GenerationSource: "examBank" } }
        && timeoutAttempts == 3, "per-attempt timeout retried twice then bank");
}
using (var http = Client(new Stub((_, _) => throw new Exception("Invalid request must not call API"))))
{
    Check((await Controller(http, settings).Generate(new GenerateExamRequest(), default)).Result is ObjectResult { StatusCode: 400 }, "invalid input remains 400");
}
using (var cancel = new CancellationTokenSource())
{
    var cancellationRetry = new LlmRetryHandler((_, _) => { cancel.Cancel(); return Task.FromCanceled(cancel.Token); });
    try { await cancellationRetry.ExecuteAsync<string>(_ => throw new TimeoutException(), cancel.Token); throw new Exception("Cancellation swallowed"); }
    catch (OperationCanceledException) { Console.WriteLine("PASS: cancellation during backoff propagated"); }
}
using (var http = Client(new Stub((_, _) =>
{
    var response = Reply(503);
    response.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(60));
    return Task.FromResult(response);
})))
{
    var watch = Stopwatch.StartNew();
    var budget = new LlmSettings { ApiKey = "test", Model = "primary", TotalTimeoutSeconds = 1 };
    var result = await Controller(http, budget, new LlmRetryHandler()).Generate(request, default);
    Check(result.Result is OkObjectResult { Value: ExamDto { GenerationSource: "examBank" } } && watch.Elapsed.TotalSeconds < 5,
        "real Retry-After delay bounded by deadline -> bank");
}
using (var cancel = new CancellationTokenSource(TimeSpan.FromMilliseconds(50)))
using (var http = Client(new Stub(async (_, token) => { await Task.Delay(Timeout.InfiniteTimeSpan, token); return Reply(200); })))
{
    try { await Controller(http, settings).Generate(request, cancel.Token); throw new Exception("Cancellation swallowed"); }
    catch (OperationCanceledException) { Console.WriteLine("PASS: caller cancellation during HTTP propagated"); }
}
var bank = new LocalExamBank();
foreach (var (topic, expected) in new[] { ("Δομές Επανάληψης", "selection-loops"), ("Πίνακες", "arrays-search-sort"), ("Υποπρογράμματα", "subprograms") })
{
    var exam = bank.GetExam(new GenerateExamRequest { TargetTopics = [topic] }, default);
    Check(exam.BankExamId == expected && exam.Sections.SelectMany(s => s.Questions).Where(q => q.SubTitle.StartsWith("Γ") || q.SubTitle.StartsWith("Δ"))
        .All(q => q.TestCases?.Count >= 2), "bank selection + test cases: " + topic);
}
for (var mask = 1; mask < 16; mask++)
{
    var themes = new[] { "Θέμα Α", "Θέμα Β", "Θέμα Γ", "Θέμα Δ" }.Where((_, index) => (mask & (1 << index)) != 0).Reverse().ToList();
    var exam = bank.GetExam(new GenerateExamRequest { TargetTopics = ["Πίνακες"], IncludeThemes = themes }, default);
    Check(exam.Sections.Count == themes.Count && exam.Sections.Sum(s => s.TotalMarks) == 100 &&
        exam.Sections.All(s => s.Questions.Sum(q => q.Marks) == s.TotalMarks && s.Questions.All(q => q.Marks > 0)), "theme subset / 100 marks: " + mask);
}
var firstBankExam = bank.GetExam(request, default);
firstBankExam.Sections[0].Questions.Clear();
Check(bank.GetExam(request, default).Sections[0].Questions.Count > 0, "bank immutable across requests");

var insightFixture = JsonSerializer.Serialize(new
{
    summary = "Χρειάζεται επανάληψη στις δομές επανάληψης.",
    recommendations = new[] { "Εξάσκηση στη ΓΙΑ και στον έλεγχο ορίων." },
    partialCreditSuggestions = new[] { new { code = "Γ1", points = 2.0, reason = "Η αρχικοποίηση είναι σωστή." } }
});
var insightEnvelope = JsonSerializer.Serialize(new
{
    candidates = new[] { new { finishReason = "STOP", content = new { parts = new[] { new { text = insightFixture } } } } }
});
using (var http = Client(new Stub(async (message, ct) =>
{
    using var payload = JsonDocument.Parse(await message.Content!.ReadAsStringAsync(ct));
    var schema = payload.RootElement.GetProperty("generationConfig").GetProperty("responseFormat")
        .GetProperty("text").GetProperty("schema");
    Check(schema.GetProperty("properties").TryGetProperty("summary", out _), "assessment uses dedicated JSON schema");
    return Reply(200, insightEnvelope);
})))
{
    var service = new AssessmentInsightService(new GeminiClient(http, Options.Create(settings), logs.CreateLogger<GeminiClient>()));
    var controller = new AssessmentInsightsController(service) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
    var insightRequest = new AssessmentInsightRequest([new AssessmentInsightItem("Γ1", "Επανάληψη", 3, 25,
        "Μερική λύση", "ΠΡΟΓΡΑΜΜΑ Δοκιμη", null, "read, for")]);
    var insightResult = await controller.Generate(insightRequest, default);
    Check(insightResult.Result is OkObjectResult { Value: AssessmentInsightResponse }, "assessment insight parsed and validated");
    var invalidResult = await controller.Generate(new AssessmentInsightRequest([]), default);
    Check(invalidResult.Result is ObjectResult { StatusCode: 400 }, "assessment insight rejects empty report");
}

var reviewFixture = JsonSerializer.Serialize(new { efficiency = "Τα μετρικά αφορούν μία εκτέλεση.", algorithmicRisks = "Έλεγξε τον διαιρέτη πριν τη διαίρεση.", styleAndAeppRules = "Χρησιμοποίησε περιγραφικά ονόματα." });
var reviewEnvelope = JsonSerializer.Serialize(new { candidates = new[] { new { finishReason = "STOP", content = new { parts = new[] { new { text = reviewFixture } } } } } });
using (var http = Client(new Stub(async (message, ct) =>
{
    using var payload = JsonDocument.Parse(await message.Content!.ReadAsStringAsync(ct));
    var schema = payload.RootElement.GetProperty("generationConfig").GetProperty("responseFormat").GetProperty("text").GetProperty("schema");
    Check(schema.GetProperty("properties").TryGetProperty("efficiency", out _), "code review dedicated schema");
    return Reply(200, reviewEnvelope);
})))
{
    var service = new CodeReviewService(new GeminiClient(http, Options.Create(settings), logs.CreateLogger<GeminiClient>()));
    var controller = new CodeReviewController(service);
    var reviewRequest = new CodeReviewRequest { StudentCode = "ΠΡΟΓΡΑΜΜΑ Δοκιμή", Metrics = new CodeReviewMetrics { ComparisonsCount = 10, AssignmentsCount = 5, LoopIterations = 2 } };
    Check((await controller.Review(reviewRequest, default)).Result is OkObjectResult { Value: CodeReviewResponse }, "structured Greek code review");
    Check((await controller.Review(reviewRequest with { Metrics = reviewRequest.Metrics with { ComparisonsCount = -1 } }, default)).Result is ObjectResult { StatusCode: 400 }, "negative review metrics rejected");
    Check((await controller.Review(reviewRequest with { StudentCode = new string('x', 12001) }, default)).Result is ObjectResult { StatusCode: 400 }, "oversized review code rejected");
}
using (var http = Client(new Stub((_, _) => Task.FromResult(Reply(200, "{\"candidates\":[]}")))))
{
    var controller = new CodeReviewController(new CodeReviewService(new GeminiClient(http, Options.Create(settings), logs.CreateLogger<GeminiClient>())));
    var invalid = await controller.Review(new CodeReviewRequest { StudentCode = "κώδικας", Metrics = new CodeReviewMetrics { ComparisonsCount = 0, AssignmentsCount = 0, LoopIterations = 0 } }, default);
    Check(invalid.Result is ObjectResult { StatusCode: 502 }, "malformed Gemini review rejected");
}
Check(typeof(CodeReviewController).IsDefined(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute), true), "code review requires authentication metadata");
var limiter = (Microsoft.AspNetCore.RateLimiting.EnableRateLimitingAttribute?)Attribute.GetCustomAttribute(typeof(CodeReviewController), typeof(Microsoft.AspNetCore.RateLimiting.EnableRateLimitingAttribute));
Check(limiter?.PolicyName == AeppGenerator.Api.Security.ApiRateLimiting.AiInsightsPolicy, "code review shares user rate and concurrency policy");

sealed class Stub(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) => send(request, ct);
}
sealed class TestEnvironment(string root) : IWebHostEnvironment
{
    public string ContentRootPath { get; set; } = root;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    public string WebRootPath { get; set; } = root;
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    public string EnvironmentName { get; set; } = "Development";
    public string ApplicationName { get; set; } = "AeppGenerator.Checks";
}
// Only for live checks where the Windows sandbox cannot use Schannel.
// Production always uses HttpClient. Node verifies TLS and receives no secrets in arguments.
sealed class NodeTlsHandler : HttpMessageHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var start = new ProcessStartInfo("node") { RedirectStandardInput = true, RedirectStandardOutput = true,
            RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8, StandardInputEncoding = new UTF8Encoding(false) };
        start.ArgumentList.Add("-e");
        start.ArgumentList.Add("let b='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>b+=c);process.stdin.on('end',async()=>{try{const r=await fetch(process.env.CHECK_URL,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':process.env.CHECK_KEY},body:b});process.stdout.write(JSON.stringify({status:r.status,headers:Object.fromEntries(r.headers),body:await r.text()}))}catch{process.exitCode=1}});");
        start.Environment["CHECK_URL"] = request.RequestUri!.ToString();
        start.Environment["CHECK_KEY"] = request.Headers.GetValues("x-goog-api-key").Single();
        using var process = Process.Start(start)!;
        using var registration = ct.Register(() => { try { if (!process.HasExited) process.Kill(); } catch (InvalidOperationException) { } });
        await process.StandardInput.WriteAsync(await request.Content!.ReadAsStringAsync(ct));
        process.StandardInput.Close();
        var output = await process.StandardOutput.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);
        if (process.ExitCode != 0) throw new HttpRequestException("Live test transport failed.");
        using var envelope = JsonDocument.Parse(output);
        var response = new HttpResponseMessage((HttpStatusCode)envelope.RootElement.GetProperty("status").GetInt32())
            { Content = new StringContent(envelope.RootElement.GetProperty("body").GetString()!, Encoding.UTF8, "application/json") };
        foreach (var header in envelope.RootElement.GetProperty("headers").EnumerateObject())
            response.Headers.TryAddWithoutValidation(header.Name, header.Value.GetString());
        return response;
    }
}
