using System.Net;

namespace AeppGenerator.Infrastructure.Llm;

/// <summary>Μία αρχική προσπάθεια και έως δύο retries, με βάση αναμονής 2 δευτερόλεπτα.</summary>
public sealed class LlmRetryHandler(Func<TimeSpan, CancellationToken, Task>? delay = null)
{
    public static bool IsTransient(Exception exception) => exception is TimeoutException or OperationCanceledException ||
        exception is HttpRequestException http && (http.StatusCode is null or
            HttpStatusCode.RequestTimeout or HttpStatusCode.TooManyRequests or
            HttpStatusCode.InternalServerError or HttpStatusCode.BadGateway or
            HttpStatusCode.ServiceUnavailable or HttpStatusCode.GatewayTimeout);

    public async Task<T> ExecuteAsync<T>(Func<CancellationToken, Task<T>> operation, CancellationToken ct)
    {
        for (var attempt = 0; ; attempt++)
        {
            ct.ThrowIfCancellationRequested();
            try { return await operation(ct); }
            catch (Exception ex) when (!ct.IsCancellationRequested && IsTransient(ex) && attempt < 2)
            {
                var wait = TimeSpan.FromSeconds(2 * Math.Pow(2, attempt));
                // Το Retry-After αποτελεί ελάχιστη αναμονή και περιορίζεται από το συνολικό deadline.
                if (ex is LlmTransientException { RetryAfter: { } retryAfter } && retryAfter > wait)
                    wait = retryAfter;
                await (delay ?? Task.Delay)(wait, ct);
            }
        }
    }
}

public sealed class LlmTransientException(HttpStatusCode status, TimeSpan? retryAfter)
    : HttpRequestException("Προσωρινή αδυναμία απόκρισης του μοντέλου.", null, status)
{
    public TimeSpan? RetryAfter { get; } = retryAfter;
}
