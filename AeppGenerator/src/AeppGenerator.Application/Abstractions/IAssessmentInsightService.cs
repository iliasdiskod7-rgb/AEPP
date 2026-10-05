using AeppGenerator.Application.Exams;

namespace AeppGenerator.Application.Abstractions;

public interface IAssessmentInsightService
{
    Task<AssessmentInsightResponse> GenerateAsync(AssessmentInsightRequest request, CancellationToken ct);
}
