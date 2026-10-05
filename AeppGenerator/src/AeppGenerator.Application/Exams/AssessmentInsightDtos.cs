namespace AeppGenerator.Application.Exams;

public sealed record AssessmentInsightItem(
    string Code, string Chapter, double Earned, double Max, string Feedback,
    string? StudentCode, string? ReferenceCode, string? AstSummary);

public sealed record AssessmentInsightRequest(List<AssessmentInsightItem> Items);
public sealed record PartialCreditSuggestion(string Code, double Points, string Reason);
public sealed record AssessmentInsightResponse(
    string Summary, List<string> Recommendations, List<PartialCreditSuggestion> PartialCreditSuggestions);
