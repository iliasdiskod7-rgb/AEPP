using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using AeppGenerator.Application.Llm;

namespace AeppGenerator.Api.Assessment;

public sealed record StartAttemptRequest(Guid AttemptId, [Required, MaxLength(200)] string ExamId, ExamJsonResponseDto? GeneratedExam);
public sealed record QuestionSubmissionRequest(
    [Required, MaxLength(200)] string QuestionId,
    [Required, MaxLength(100000)] string StudentAnswerJson,
    [Required, MaxLength(200000)] string TestResultsJson,
    decimal AutoPoints, decimal MaxPoints,
    [MaxLength(5000)] string? Feedback,
    [MaxLength(100000)] string? StudentAnswer,
    [MaxLength(2000)] string? AstSummary);
public sealed record SubmitAttemptRequest(Guid AttemptId, [Required] List<QuestionSubmissionRequest> Questions);
public sealed record GradeAttemptRequest(
    [Required, Range(0, 100)] decimal? RevisedScore,
    [Required, StringLength(5000, MinimumLength = 1)] string TeacherComments,
    [Range(1, int.MaxValue)] int ExpectedVersion);
public sealed record SectionScore(string Theme, decimal AutoPoints, decimal MaxPoints);
public sealed record AttemptSummary(Guid Id, string ExamId, string ExamTitle, string StudentName, DateTime StartedAt, DateTime? SubmittedAt,
    decimal AutoGradeScore, decimal FinalScore, ExamAttemptStatus Status, int Version, int RevisionCount, List<SectionScore> Sections);
public sealed record QuestionSubmissionDto(Guid Id, string QuestionId, string Theme, string QuestionCode,
    string StudentAnswerJson, string TestResultsJson, decimal AutoPoints, decimal MaxPoints);
public sealed record GradeRevisionDto(Guid Id, string TeacherId, string TeacherName, decimal RevisedScore, string TeacherComments, DateTime RevisedAt, int Version);
public sealed record AttemptDetail(Guid AttemptId, string ExamId, string ExamTitle, string StudentName, DateTime StartedAt, DateTime? SubmittedAt,
    decimal AutoGradeScore, decimal FinalScore, ExamAttemptStatus Status, int Version, JsonElement Exam, JsonElement? Report,
    List<QuestionSubmissionDto> QuestionSubmissions, List<GradeRevisionDto> GradeRevisions);
/// <summary>A randomly selected practice exam with answer keys and hidden test inputs withheld.</summary>
public sealed record RandomExamResponse(string ExamId, string Title, JsonElement Exam, int HiddenTestCases);
public sealed record AttemptPage(List<AttemptSummary> Items, int Total, int Page, int PageSize);
public sealed class AttemptNotFoundException : Exception;
public sealed class AttemptConflictException(string message) : Exception(message);
