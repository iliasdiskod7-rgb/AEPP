using AeppGenerator.Domain.Enums;

namespace AeppGenerator.Domain.Entities;

public sealed class ExamSection
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ExamId { get; set; }
    public SectionType SectionType { get; set; }
    public string Title { get; set; } = string.Empty;
    public int TotalMarks { get; set; }
    public List<QuestionItem> Questions { get; set; } = [];
}
