using System.Diagnostics;
using System.Text.Json.Nodes;

namespace AeppGenerator.Api.Assessment;

/// <summary>Runs the shared ΓΛΩΣΣΑ interpreter in a bounded, separate Node process.</summary>
public sealed class ServerProgramGrader(IConfiguration configuration)
{
    private static readonly SemaphoreSlim Slots = new(2, 2);
    public async Task<Dictionary<string, JsonNode>> Grade(JsonNode definition, JsonObject answers, CancellationToken ct)
    {
        if (!await Slots.WaitAsync(TimeSpan.FromSeconds(5), ct)) throw new GradingUnavailableException();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(15));
        using var process = new Process();
        try
        {
            var script = Path.Combine(AppContext.BaseDirectory, "Assessment", "Grader", "grade.mjs");
            if (!File.Exists(script)) throw new GradingUnavailableException();
            process.StartInfo = new ProcessStartInfo(configuration["Assessment:NodePath"] ?? "node") {
                UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true
            };
            process.StartInfo.ArgumentList.Add("--max-old-space-size=128");
            process.StartInfo.ArgumentList.Add(script);
            process.Start();
            var output = process.StandardOutput.ReadToEndAsync(timeout.Token);
            var errors = process.StandardError.ReadToEndAsync(timeout.Token);
            await process.StandardInput.WriteAsync(new JsonObject { ["exam"] = definition.DeepClone(), ["answers"] = answers }.ToJsonString().AsMemory(), timeout.Token);
            process.StandardInput.Close();
            await process.WaitForExitAsync(timeout.Token);
            var json = await output;
            await errors;
            if (process.ExitCode != 0 || json.Length > 2_000_000) throw new GradingUnavailableException();
            var report = JsonNode.Parse(json)!;
            return report["sections"]!.AsArray().SelectMany(section => section!["questions"]!.AsArray())
                .ToDictionary(question => question!["questionId"]!.GetValue<string>(), question => question!, StringComparer.Ordinal);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { throw new GradingUnavailableException(); }
        catch (System.ComponentModel.Win32Exception) { throw new GradingUnavailableException(); }
        finally
        {
            try { if (process.Id != 0 && !process.HasExited) process.Kill(entireProcessTree: true); }
            catch (InvalidOperationException) { }
            Slots.Release();
        }
    }
}
public sealed class GradingUnavailableException : Exception
{
    public GradingUnavailableException() : base("Η αυτόματη βαθμολόγηση δεν είναι διαθέσιμη αυτή τη στιγμή. Οι απαντήσεις σου διατηρούνται. Δοκίμασε ξανά.") { }
}
