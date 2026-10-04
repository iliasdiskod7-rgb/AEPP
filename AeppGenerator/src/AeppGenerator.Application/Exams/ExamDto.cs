using AeppGenerator.Domain.Enums;

namespace AeppGenerator.Application.Exams;

public sealed record ExamDto(
    Guid Id, string Title, string AcademicYear, string TargetTopic,
    Difficulty Difficulty, DateTime CreatedAt, List<ExamSectionDto> Sections);

public sealed record ExamSectionDto(
    Guid Id, Guid ExamId, SectionType SectionType, string Title,
    int TotalMarks, List<QuestionItemDto> Questions);

public sealed record QuestionItemDto(
    Guid Id, Guid SectionId, int OrderIndex, string SubTitle,
    string ContentMarkdown, string SolutionMarkdown, int Marks,
    string? ExecutionTraceJson);
