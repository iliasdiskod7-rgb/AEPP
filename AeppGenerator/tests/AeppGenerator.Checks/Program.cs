using System.Diagnostics;
using System.Net;
using System.Text;
using System.Text.Json;
using AeppGenerator.Api.Controllers;
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

HttpClient Client(HttpMessageHandler handler) => new(handler)
    { BaseAddress = new Uri("https://generativelanguage.googleapis.com/"), Timeout = Timeout.InfiniteTimeSpan };
ExamsController Controller(HttpClient http, LlmSettings config) => new(
    new LlmExamGeneratorService(new GeminiClient(http, Options.Create(config), logs.CreateLogger<GeminiClient>()),
        new TestEnvironment(sourceRoot))) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
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

var calls = new List<string>();
using (var http = Client(new Stub(async (message, ct) =>
{
    calls.Add(message.RequestUri!.AbsolutePath);
    using var payload = JsonDocument.Parse(await message.Content!.ReadAsStringAsync(ct));
    Check(payload.RootElement.GetProperty("generationConfig").GetProperty("responseFormat").GetProperty("text")
        .GetProperty("mimeType").GetString() == "APPLICATION_JSON", "Gemini enum in serialized request");
    return calls.Count == 1 ? Reply(503) : Reply(200, valid);
})))
{
    var result = await Controller(http, settings).Generate(request, default);
    Check(result.Result is OkObjectResult { Value: ExamDto { Sections.Count: 4 } }, "503 primary -> fallback -> validated ExamDto");
    Check(calls.Count == 2 && calls[1].Contains("fallback"), "fallback selected");
}
foreach (var (provider, api, count) in new[] { (503, 503, 2), (429, 429, 1), (400, 502, 1), (403, 502, 1), (404, 502, 2) })
{
    var attempts = 0;
    using var http = Client(new Stub((_, _) => { attempts++; return Task.FromResult(Reply(provider)); }));
    var result = await Controller(http, settings).Generate(request, default);
    Check(result.Result is ObjectResult { Value: ProblemDetails p } && p.Status == api && attempts == count,
        $"provider {provider} -> API {api}, {count} attempt(s)");
}
using (var http = Client(new Stub((_, _) => Task.FromResult(Reply(200, "{}")))))
{
    var result = await Controller(http, settings).Generate(request, default);
    Check(result.Result is ObjectResult { StatusCode: 502 }, "malformed response rejected");
}
using (var http = Client(new Stub(async (_, ct) => { await Task.Delay(Timeout.InfiniteTimeSpan, ct); return Reply(200); })))
{
    var budget = new LlmSettings { ApiKey = "test", Model = "primary", TotalTimeoutSeconds = 1 };
    var result = await Controller(http, budget).Generate(request, default);
    Check(result.Result is ObjectResult { StatusCode: 504 }, "total timeout -> 504");
    using var cancel = new CancellationTokenSource(); cancel.Cancel();
    try { await Controller(http, settings).Generate(request, cancel.Token); throw new Exception("Cancellation swallowed"); }
    catch (OperationCanceledException) { Console.WriteLine("PASS: caller cancellation propagated"); }
}
using (var http = Client(new Stub((_, _) =>
{
    var response = Reply(503);
    response.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(60));
    return Task.FromResult(response);
})))
{
    var budget = new LlmSettings { ApiKey = "test", Model = "primary", TotalTimeoutSeconds = 1 };
    var watch = Stopwatch.StartNew();
    var result = await Controller(http, budget).Generate(request, default);
    Check(result.Result is ObjectResult { StatusCode: 504 } && watch.Elapsed.TotalSeconds < 5, "Retry-After bounded by total deadline");
}

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
