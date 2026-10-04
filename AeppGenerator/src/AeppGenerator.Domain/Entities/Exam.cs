using AeppGenerator.Domain.Enums;

namespace AeppGenerator.Domain.Entities;

public sealed class Exam
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string AcademicYear { get; set; } = string.Empty;
    public string TargetTopic { get; set; } = string.Empty;
    public Difficulty Difficulty { get; set; } = Difficulty.Medium;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<ExamSection> Sections { get; set; } = [];
}
