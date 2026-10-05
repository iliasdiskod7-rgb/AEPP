using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AeppGenerator.Application.Llm;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AeppGenerator.Infrastructure.Llm;

public sealed class GeminiClient(HttpClient httpClient, IOptions<LlmSettings> options,
    ILogger<GeminiClient> logger)
{
    public async Task<string> GenerateAsync(string systemPrompt, string userPrompt, CancellationToken ct)
        => await GenerateAsync(systemPrompt, userPrompt, ExamJsonSchema.Schema, 0.9, ct);

    public async Task<string> GenerateAsync(string systemPrompt, string userPrompt,
        string responseSchema, double temperature, CancellationToken ct)
    {
        var settings = options.Value;
        if (string.IsNullOrWhiteSpace(settings.ApiKey))
            throw new InvalidOperationException("Δεν έχει οριστεί το κλειδί Gemini στο LlmSettings:ApiKey.");
        var models = new[] { settings.Model }.Concat(settings.FallbackModels)
            .Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.Ordinal).ToArray();
        if (models.Length == 0) throw new InvalidOperationException("Δεν έχει οριστεί μοντέλο Gemini.");

        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct);
        deadline.CancelAfter(TimeSpan.FromSeconds(settings.TotalTimeoutSeconds));
        using var schema = JsonDocument.Parse(responseSchema);
        var payload = new
        {
            systemInstruction = new { parts = new[] { new { text = systemPrompt } } },
            contents = new[] { new { role = "user", parts = new[] { new { text = userPrompt } } } },
            generationConfig = new
            {
                temperature,
                maxOutputTokens = settings.MaxOutputTokens,
                responseFormat = new { text = new { mimeType = "APPLICATION_JSON", schema = schema.RootElement } }
            }
        };
        var unavailableModels = new HashSet<string>(StringComparer.Ordinal);
        var lastStatus = HttpStatusCode.ServiceUnavailable;
        try
        {
            for (var round = 0; round < settings.MaxRounds; round++)
            {
                foreach (var model in models.Where(x => !unavailableModels.Contains(x)))
                {
                    deadline.Token.ThrowIfCancellationRequested();
                    using var attempt = CancellationTokenSource.CreateLinkedTokenSource(deadline.Token);
                    attempt.CancelAfter(TimeSpan.FromSeconds(settings.AttemptTimeoutSeconds));
                    using var message = new HttpRequestMessage(HttpMethod.Post,
                        $"v1beta/models/{Uri.EscapeDataString(model)}:generateContent");
                    message.Headers.Add("x-goog-api-key", settings.ApiKey);
                    message.Content = JsonContent.Create(payload);
                    try
                    {
                        using var response = await httpClient.SendAsync(message, attempt.Token);
                        if (response.IsSuccessStatusCode)
                        {
                            var body = await response.Content.ReadAsStringAsync(attempt.Token);
                            logger.LogInformation("Gemini completed with {Model}, round {Round}", model, round + 1);
                            return body;
                        }

                        lastStatus = response.StatusCode;
                        // Καταγράφονται μόνο μοντέλο/status. Ποτέ κλειδί, prompts ή σώμα απόκρισης.
                        logger.LogWarning("Gemini {Model}: HTTP {Status}, round {Round}", model, (int)lastStatus, round + 1);
                        if (lastStatus is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                            throw Failure(lastStatus, "Το Gemini δεν δέχτηκε το κλειδί ή τα δικαιώματα πρόσβασης. Ελέγξτε τις ρυθμίσεις του backend.");
                        if (lastStatus == HttpStatusCode.NotFound)
                        {
                            unavailableModels.Add(model);
                            continue;
                        }
                        if (lastStatus == HttpStatusCode.TooManyRequests)
                        {
                            // Δεν αλλάζουμε μοντέλο για να παρακάμψουμε όριο χρήσης/ποσόστωση.
                            throw Failure(lastStatus, "Το Gemini έφτασε στο όριο χρήσης. Περιμένετε πριν δοκιμάσετε ξανά ή ελέγξτε την ποσόστωση στο Google AI Studio.");
                        }
                        if (lastStatus is not (HttpStatusCode.RequestTimeout or HttpStatusCode.InternalServerError or
                            HttpStatusCode.BadGateway or HttpStatusCode.ServiceUnavailable or HttpStatusCode.GatewayTimeout))
                            throw Failure(lastStatus, "Το Gemini απέρριψε τις ρυθμίσεις παραγωγής. Ελέγξτε το μοντέλο και το αίτημα στο backend.");

                        var retryAfter = response.Headers.RetryAfter;
                        var delay = retryAfter?.Delta ?? (retryAfter?.Date - DateTimeOffset.UtcNow);
                        if (delay > TimeSpan.Zero)
                        {
                            // Το συνολικό deadline ακυρώνει ακόμη και μεγάλο Retry-After.
                            await Task.Delay(delay.Value, deadline.Token);
                        }
                    }
                    catch (OperationCanceledException) when (!deadline.IsCancellationRequested)
                    {
                        lastStatus = HttpStatusCode.GatewayTimeout;
                        logger.LogWarning("Gemini {Model}: attempt timed out", model);
                    }
                }
                if (unavailableModels.Count == models.Length) break;
                if (round + 1 < settings.MaxRounds)
                    await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, round + 1) + Random.Shared.NextDouble()), deadline.Token);
            }
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            throw Failure(HttpStatusCode.GatewayTimeout, "Η παραγωγή ξεπέρασε τον διαθέσιμο χρόνο. Δοκιμάστε ξανά σε λίγο.");
        }
        if (unavailableModels.Count == models.Length)
            throw Failure(HttpStatusCode.NotFound, "Τα ρυθμισμένα μοντέλα Gemini δεν είναι διαθέσιμα για αυτόν τον λογαριασμό.");
        if (lastStatus == HttpStatusCode.GatewayTimeout)
            throw Failure(lastStatus, "Τα μοντέλα Gemini δεν απάντησαν εγκαίρως. Δοκιμάστε ξανά σε λίγο.");
        throw Failure(HttpStatusCode.ServiceUnavailable,
            "Το Gemini έχει αυξημένο φόρτο. Δοκιμάστηκαν τα διαθέσιμα εναλλακτικά μοντέλα χωρίς επιτυχία. Δοκιμάστε ξανά σε λίγο.");
    }

    private static HttpRequestException Failure(HttpStatusCode status, string message) => new(message, null, status);
}
