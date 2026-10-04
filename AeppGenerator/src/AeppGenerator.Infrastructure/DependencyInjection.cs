using Microsoft.Extensions.DependencyInjection;

namespace AeppGenerator.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        // Register an ILlmExamGeneratorService implementation here when a provider is chosen.
        return services;
    }
}
