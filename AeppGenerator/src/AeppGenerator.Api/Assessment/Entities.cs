namespace AeppGenerator.Api.Assessment;

public enum ExamAttemptStatus { IN_PROGRESS, SUBMITTED, GRADED_BY_TEACHER }

// Η οντότητα αυτή χαρτογραφεί τον υπάρχοντα πίνακα Users, χωρίς αλλαγή του authentication.
public sealed class AssessmentUser
{
    public string Id { get; set; } = "";
    public string FullName { get; set; } = "";
}

public sealed class Exam
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Source { get; set; } = "";
    public string? CreatedByUserId { get; set; }
    public string DefinitionJson { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public AssessmentUser? CreatedBy { get; set; }
}

public sealed class ExamAttempt
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public string ExamId { get; set; } = "";
    public DateTime StartedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public decimal AutoGradeScore { get; set; }
    public decimal FinalScore { get; set; }
    public ExamAttemptStatus Status { get; set; }
    public int Version { get; set; }
    public string? SubmissionHash { get; set; }
    public string ReportJson { get; set; } = "{}";
    public AssessmentUser User { get; set; } = null!;
    public Exam Exam { get; set; } = null!;
    public List<QuestionSubmission> QuestionSubmissions { get; set; } = [];
    public List<GradeRevision> GradeRevisions { get; set; } = [];
}

public sealed class QuestionSubmission
{
    public Guid Id { get; set; }
    public Guid ExamAttemptId { get; set; }
    public string QuestionId { get; set; } = "";
    public string Theme { get; set; } = "";
    public string QuestionCode { get; set; } = "";
    public int Position { get; set; }
    public string StudentAnswerJson { get; set; } = "";
    public string TestResultsJson { get; set; } = "[]";
    public decimal AutoPoints { get; set; }
    public decimal MaxPoints { get; set; }
    public ExamAttempt ExamAttempt { get; set; } = null!;
}

public sealed class GradeRevision
{
    public Guid Id { get; set; }
    public Guid ExamAttemptId { get; set; }
    public string TeacherId { get; set; } = "";
    public decimal RevisedScore { get; set; }
    public string TeacherComments { get; set; } = "";
    public DateTime RevisedAt { get; set; }
    public int Version { get; set; }
    public ExamAttempt ExamAttempt { get; set; } = null!;
    public AssessmentUser Teacher { get; set; } = null!;
}
