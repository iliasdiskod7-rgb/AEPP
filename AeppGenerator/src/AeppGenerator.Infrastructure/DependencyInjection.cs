using AeppGenerator.Application.Abstractions;
using AeppGenerator.Infrastructure.Llm;
using AeppGenerator.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AeppGenerator.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Bind LlmSettings
        services.AddOptions<LlmSettings>().Bind(configuration.GetSection(LlmSettings.SectionName))
            .Validate(x => x.MaxRounds is >= 1 and <= 3 && x.AttemptTimeoutSeconds is >= 1 and <= 240 &&
                x.TotalTimeoutSeconds is >= 1 and <= 240 && x.MaxOutputTokens is >= 1024 and <= 65536 &&
                x.FallbackModels is not null && x.FallbackModels.Length <= 2,
                "Μη έγκυρα όρια αναμονής ή εναλλακτικά μοντέλα Gemini.");

        // Register HttpClient for Gemini Llm Service
        services.AddHttpClient<GeminiClient>(client =>
        {
            client.BaseAddress = new Uri("https://generativelanguage.googleapis.com/");
            client.Timeout = Timeout.InfiniteTimeSpan;
        }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false })
          .RedactLoggedHeaders(["x-goog-api-key"]);
        services.AddScoped<ILlmExamGeneratorService, LlmExamGeneratorService>();
        services.AddScoped<IAssessmentInsightService, AssessmentInsightService>();

        return services;
    }

    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
        => services.AddInfrastructure(configuration);
}
