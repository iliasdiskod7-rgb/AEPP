using AeppGenerator.Api.Assessment;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace AeppGenerator.Api.Data;

public sealed class AssessmentDbContext(DbContextOptions<AssessmentDbContext> options) : DbContext(options)
{
    public DbSet<Exam> Exams => Set<Exam>();
    public DbSet<ExamAttempt> ExamAttempts => Set<ExamAttempt>();
    public DbSet<QuestionSubmission> QuestionSubmissions => Set<QuestionSubmission>();
    public DbSet<GradeRevision> GradeRevisions => Set<GradeRevision>();
    public DbSet<AeppGenerator.Api.Notes.CodeNote> CodeNotes => Set<AeppGenerator.Api.Notes.CodeNote>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        AeppGenerator.Api.Notes.CodeNoteModel.Configure(model);
        var score = new ValueConverter<decimal, long>(value => (long)(value * 100m), value => value / 100m);
        var utc = new ValueConverter<DateTime, DateTime>(value => value, value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
        model.Entity<AssessmentUser>(entity => {
            entity.ToTable("Users", table => table.ExcludeFromMigrations());
            entity.HasKey(user => user.Id);
            entity.Property(user => user.FullName).IsRequired();
        });
        model.Entity<Exam>(entity => {
            entity.ToTable("Exams");
            entity.HasKey(exam => exam.Id);
            entity.Property(exam => exam.Title).IsRequired().HasMaxLength(200);
            entity.Property(exam => exam.Source).IsRequired();
            entity.Property(exam => exam.DefinitionJson).IsRequired();
            entity.Property(exam => exam.CreatedAt).HasConversion(utc);
            entity.HasOne(exam => exam.CreatedBy).WithMany().HasForeignKey(exam => exam.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<ExamAttempt>(entity => {
            entity.ToTable("ExamAttempts", table => {
                table.HasCheckConstraint("CK_Attempt_Scores", "AutoGradeScore BETWEEN 0 AND 10000 AND FinalScore BETWEEN 0 AND 10000");
                table.HasCheckConstraint("CK_Attempt_Status", "Status IN ('IN_PROGRESS','SUBMITTED','GRADED_BY_TEACHER')");
                table.HasCheckConstraint("CK_Attempt_Submitted", "(Status = 'IN_PROGRESS' AND SubmittedAt IS NULL) OR (Status <> 'IN_PROGRESS' AND SubmittedAt IS NOT NULL)");
            });
            entity.HasKey(attempt => attempt.Id);
            entity.Property(attempt => attempt.AutoGradeScore).HasConversion(score);
            entity.Property(attempt => attempt.FinalScore).HasConversion(score);
            entity.Property(attempt => attempt.Status).HasConversion<string>();
            entity.Property(attempt => attempt.ReportJson).IsRequired();
            entity.Property(attempt => attempt.Version).IsConcurrencyToken();
            entity.Property(attempt => attempt.StartedAt).HasConversion(utc);
            entity.Property(attempt => attempt.SubmittedAt).HasConversion(utc);
            entity.HasOne(attempt => attempt.User).WithMany().HasForeignKey(attempt => attempt.UserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(attempt => attempt.Exam).WithMany().HasForeignKey(attempt => attempt.ExamId).OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(attempt => new { attempt.UserId, attempt.StartedAt });
            entity.HasIndex(attempt => new { attempt.Status, attempt.SubmittedAt });
        });
        model.Entity<QuestionSubmission>(entity => {
            entity.ToTable("QuestionSubmissions", table => table.HasCheckConstraint("CK_Question_Scores", "MaxPoints > 0 AND MaxPoints <= 10000 AND AutoPoints BETWEEN 0 AND MaxPoints"));
            entity.HasKey(question => question.Id);
            entity.Property(question => question.AutoPoints).HasConversion(score);
            entity.Property(question => question.MaxPoints).HasConversion(score);
            entity.Property(question => question.QuestionId).IsRequired();
            entity.Property(question => question.Theme).IsRequired();
            entity.Property(question => question.QuestionCode).IsRequired();
            entity.Property(question => question.StudentAnswerJson).IsRequired();
            entity.Property(question => question.TestResultsJson).IsRequired();
            entity.HasOne(question => question.ExamAttempt).WithMany(attempt => attempt.QuestionSubmissions).HasForeignKey(question => question.ExamAttemptId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(question => new { question.ExamAttemptId, question.QuestionId }).IsUnique();
        });
        model.Entity<GradeRevision>(entity => {
            entity.ToTable("GradeRevisions", table => table.HasCheckConstraint("CK_Revision_Score", "RevisedScore BETWEEN 0 AND 10000"));
            entity.HasKey(revision => revision.Id);
            entity.Property(revision => revision.RevisedScore).HasConversion(score);
            entity.Property(revision => revision.TeacherComments).IsRequired().HasMaxLength(5000);
            entity.Property(revision => revision.RevisedAt).HasConversion(utc);
            entity.HasOne(revision => revision.ExamAttempt).WithMany(attempt => attempt.GradeRevisions).HasForeignKey(revision => revision.ExamAttemptId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(revision => revision.Teacher).WithMany().HasForeignKey(revision => revision.TeacherId).OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(revision => new { revision.ExamAttemptId, revision.Version }).IsUnique();
        });
    }
}
