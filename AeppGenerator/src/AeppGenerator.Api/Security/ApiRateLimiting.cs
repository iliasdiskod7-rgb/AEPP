using System.Globalization;
using System.Threading.RateLimiting;
using AeppGenerator.Api.Auth;
using Microsoft.AspNetCore.RateLimiting;

namespace AeppGenerator.Api.Security;

public static class ApiRateLimiting
{
    public const string AiInsightsPolicy = "AiInsightsPolicy";
    public const string RejectionMessage = "Πολύ συχνά αιτήματα. Παρακαλώ περιμένετε λίγα δευτερόλεπτα.";

    private static bool IsInsights(HttpContext context) =>
        context.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName == AiInsightsPolicy;

    private static string Ip(HttpContext context)
    {
        var address = context.Connection.RemoteIpAddress;
        // Δεν εμπιστευόμαστε μη επαληθευμένα X-Forwarded-For headers.
        return (address?.IsIPv4MappedToIPv6 == true ? address.MapToIPv4() : address)?.ToString() ?? "unknown";
    }

    public static void Configure(RateLimiterOptions options)
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        options.AddPolicy(AiInsightsPolicy, context =>
            RateLimitPartition.GetFixedWindowLimiter(AuthService.UserId(context.User), _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromSeconds(60),
                QueueLimit = 0,
                AutoReplenishment = true
            }));

        options.GlobalLimiter = PartitionedRateLimiter.CreateChained(
            PartitionedRateLimiter.Create<HttpContext, string>(context =>
                IsInsights(context)
                    ? RateLimitPartition.GetNoLimiter("insights")
                    : RateLimitPartition.GetFixedWindowLimiter(Ip(context), _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 120,
                        Window = TimeSpan.FromSeconds(60),
                        QueueLimit = 0,
                        AutoReplenishment = true
                    })),
            // Διατηρείται το αυστηρότερο κοινό όριο login/register ανά IP.
            PartitionedRateLimiter.Create<HttpContext, string>(context =>
                context.Request.Path.StartsWithSegments("/api/auth/login") || context.Request.Path.StartsWithSegments("/api/auth/register")
                    ? RateLimitPartition.GetFixedWindowLimiter(Ip(context), _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 10,
                        Window = TimeSpan.FromSeconds(60),
                        QueueLimit = 0,
                        AutoReplenishment = true
                    })
                    : RateLimitPartition.GetNoLimiter("other")),
            // Το lease κρατιέται μέχρι να ολοκληρωθεί το HTTP request.
            PartitionedRateLimiter.Create<HttpContext, string>(context =>
                IsInsights(context)
                    ? RateLimitPartition.GetConcurrencyLimiter(AuthService.UserId(context.User), _ => new ConcurrencyLimiterOptions
                    {
                        PermitLimit = 2,
                        QueueLimit = 0,
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst
                    })
                    : RateLimitPartition.GetNoLimiter("other")));

        options.OnRejected = async (context, cancellationToken) =>
        {
            var response = context.HttpContext.Response;
            response.StatusCode = StatusCodes.Status429TooManyRequests;
            var seconds = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter)
                ? Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds)) : 1;
            response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
            response.Headers.CacheControl = "no-store";
            await response.WriteAsJsonAsync(new { message = RejectionMessage }, cancellationToken);
        };
    }
}
