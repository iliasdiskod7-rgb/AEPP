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
        services.Configure<LlmSettings>(configuration.GetSection(LlmSettings.SectionName));

        // Register HttpClient for Gemini Llm Service
        services.AddHttpClient<ILlmExamGeneratorService, LlmExamGeneratorService>();

        return services;
    }

    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
        => services.AddInfrastructure(configuration);
}