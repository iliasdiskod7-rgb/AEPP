using AeppGenerator.Application.Abstractions;
using AeppGenerator.Application.Exams;
using AeppGenerator.Application.Llm;
using AeppGenerator.Domain.Enums;
using AeppGenerator.Infrastructure.Llm;
using AeppGenerator.Infrastructure.Prompts;
using Microsoft.Extensions.Logging;

namespace AeppGenerator.Infrastructure.Services;

/// <summary>Ο συντονιστής fallback του endpoint δημιουργίας διαγωνισμάτων.</summary>
public sealed class FallbackExamGeneratorService(LlmExamGeneratorService generator,
    LocalExamBank bank, ILogger<FallbackExamGeneratorService> logger) : ILlmExamGeneratorService
{
    public async Task<ExamDto> GenerateExamAsync(GenerateExamRequest request, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        GlowSystemPrompts.BuildUserPrompt(request);
        try { return await generator.GenerateExamAsync(request, ct); }
        catch (Exception ex) when (!ct.IsCancellationRequested && LlmRetryHandler.IsTransient(ex))
        {
            // Μόνο τύπος/status: ποτέ prompts, περιεχόμενο εξετάσεων ή API key.
            logger.LogWarning("Exam generation exhausted retries: {Type}, HTTP {Status}. Loading local bank.",
                ex.GetType().Name, (ex as HttpRequestException)?.StatusCode);
            return bank.GetExam(request, ct);
        }
    }

    public async Task<ExamDto> GenerateExamAsync(GenerateExamCommand command, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(command);
        var exam = await GenerateExamAsync(new GenerateExamRequest
        {
            TargetTopics = [command.TargetTopic], Difficulty = command.Difficulty switch
            {
                Difficulty.Easy => "Εύκολο", Difficulty.Medium => "Μεσαίο",
                Difficulty.Hard => "Αυξημένης Δυσκολίας",
                _ => throw new ArgumentException("Μη έγκυρη δυσκολία.")
            }
        }, ct);
        return exam.GenerationSource == "examBank" ? exam with { AcademicYear = command.AcademicYear }
            : exam with { Title = command.Title, AcademicYear = command.AcademicYear };
    }
}
