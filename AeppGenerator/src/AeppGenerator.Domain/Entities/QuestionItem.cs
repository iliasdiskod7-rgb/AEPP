namespace AeppGenerator.Domain.Entities;

public sealed class QuestionItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SectionId { get; set; }
    public int OrderIndex { get; set; }
    public string SubTitle { get; set; } = string.Empty;
    public string ContentMarkdown { get; set; } = string.Empty;
    public string SolutionMarkdown { get; set; } = string.Empty;
    public int Marks { get; set; }
    public string? ExecutionTraceJson { get; set; }
}
