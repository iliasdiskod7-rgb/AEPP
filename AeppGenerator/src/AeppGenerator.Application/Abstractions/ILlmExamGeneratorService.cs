using AeppGenerator.Application.Exams;
using AeppGenerator.Application.Llm;

namespace AeppGenerator.Application.Abstractions;

public interface ILlmExamGeneratorService
{
    Task<ExamDto> GenerateExamAsync(GenerateExamCommand command, CancellationToken ct);

    /// <summary>Παράγει δομημένο διαγώνισμα με ελληνικές επιλογές και περιεχόμενο.</summary>
    Task<ExamJsonResponseDto> GenerateExamAsync(GenerateExamRequest request, CancellationToken ct);
}
