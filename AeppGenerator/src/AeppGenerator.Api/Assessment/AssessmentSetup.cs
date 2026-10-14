using AeppGenerator.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace AeppGenerator.Api.Assessment;

public static class AssessmentSetup
{
    public static void AddExamAttempts(this WebApplicationBuilder builder)
    {
        builder.Services.AddDbContext<AssessmentDbContext>((services, options) =>
            options.UseSqlite(services.GetRequiredService<AccountStore>().ConnectionString));
        builder.Services.AddSingleton<ExamCatalog>();
        builder.Services.AddScoped<ExamAttemptService>();
        builder.Services.AddSingleton<ServerProgramGrader>();
    }

    public static async Task InitializeExamAttempts(this WebApplication app, CancellationToken ct = default)
    {
        using var scope = app.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<AssessmentDbContext>();
        await database.Database.MigrateAsync(ct);
        await scope.ServiceProvider.GetRequiredService<ExamCatalog>().Seed(database, ct);
    }
}
