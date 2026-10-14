using AeppGenerator.Application.Exams;

namespace AeppGenerator.Application.Abstractions;

public interface ICodeReviewService
{
    Task<CodeReviewResponse> ReviewAsync(CodeReviewRequest request, CancellationToken ct);
}
