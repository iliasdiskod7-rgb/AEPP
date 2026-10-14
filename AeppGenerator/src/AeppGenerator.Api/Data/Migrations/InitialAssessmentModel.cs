using Microsoft.EntityFrameworkCore;

namespace AeppGenerator.Api.Data.Migrations;

// Αμετάβλητο μοντέλο του πρώτου migration, ανεξάρτητο από μελλοντικά snapshots.
internal static class InitialAssessmentModel
{
    internal static void Configure(ModelBuilder model)
    {
        model.HasAnnotation("ProductVersion", "8.0.31");
        model.Entity("AeppGenerator.Api.Assessment.AssessmentUser", entity => {
            entity.Property<string>("Id").IsRequired().HasColumnType("TEXT");
            entity.Property<string>("FullName").IsRequired().HasColumnType("TEXT");
            entity.HasKey("Id");
            entity.ToTable("Users", table => table.ExcludeFromMigrations());
        });
        model.Entity("AeppGenerator.Api.Assessment.Exam", entity => {
            entity.Property<string>("Id").IsRequired().HasColumnType("TEXT");
            entity.Property<string>("Title").IsRequired().HasColumnType("TEXT").HasMaxLength(200);
            entity.Property<string>("Source").IsRequired().HasColumnType("TEXT");
            entity.Property<string?>("CreatedByUserId").HasColumnType("TEXT");
            entity.Property<string>("DefinitionJson").IsRequired().HasColumnType("TEXT");
            entity.Property<DateTime>("CreatedAt").HasColumnType("TEXT");
            entity.HasKey("Id");
            entity.ToTable("Exams"); entity.HasIndex("CreatedByUserId");
        });
        model.Entity("AeppGenerator.Api.Assessment.ExamAttempt", entity => {
            entity.Property<Guid>("Id").HasColumnType("TEXT").ValueGeneratedOnAdd();
            entity.Property<string>("UserId").IsRequired().HasColumnType("TEXT");
            entity.Property<string>("ExamId").IsRequired().HasColumnType("TEXT");
            entity.Property<DateTime>("StartedAt").HasColumnType("TEXT");
            entity.Property<DateTime?>("SubmittedAt").HasColumnType("TEXT");
            entity.Property<long>("AutoGradeScore").HasColumnType("INTEGER");
            entity.Property<long>("FinalScore").HasColumnType("INTEGER");
            entity.Property<string>("Status").IsRequired().HasColumnType("TEXT");
            entity.Property<int>("Version").HasColumnType("INTEGER").IsConcurrencyToken();
            entity.Property<string?>("SubmissionHash").HasColumnType("TEXT");
            entity.Property<string>("ReportJson").IsRequired().HasColumnType("TEXT");
            entity.HasKey("Id");
            entity.ToTable("ExamAttempts", table => { table.HasCheckConstraint("CK_Attempt_Scores", "AutoGradeScore BETWEEN 0 AND 10000 AND FinalScore BETWEEN 0 AND 10000"); table.HasCheckConstraint("CK_Attempt_Status", "Status IN ('IN_PROGRESS','SUBMITTED','GRADED_BY_TEACHER')"); table.HasCheckConstraint("CK_Attempt_Submitted", "(Status = 'IN_PROGRESS' AND SubmittedAt IS NULL) OR (Status <> 'IN_PROGRESS' AND SubmittedAt IS NOT NULL)"); });
            entity.HasIndex("UserId", "StartedAt"); entity.HasIndex("Status", "SubmittedAt"); entity.HasIndex("ExamId");
        });
        model.Entity("AeppGenerator.Api.Assessment.QuestionSubmission", entity => {
            entity.Property<Guid>("Id").HasColumnType("TEXT").ValueGeneratedOnAdd();
            entity.Property<Guid>("ExamAttemptId").HasColumnType("TEXT");
            entity.Property<string>("QuestionId").IsRequired().HasColumnType("TEXT");
            entity.Property<string>("Theme").IsRequired().HasColumnType("TEXT");
            entity.Property<string>("QuestionCode").IsRequired().HasColumnType("TEXT");
            entity.Property<int>("Position").HasColumnType("INTEGER");
            entity.Property<string>("StudentAnswerJson").IsRequired().HasColumnType("TEXT");
            entity.Property<string>("TestResultsJson").IsRequired().HasColumnType("TEXT");
            entity.Property<long>("AutoPoints").HasColumnType("INTEGER");
            entity.Property<long>("MaxPoints").HasColumnType("INTEGER");
            entity.HasKey("Id");
            entity.ToTable("QuestionSubmissions", table => table.HasCheckConstraint("CK_Question_Scores", "MaxPoints > 0 AND MaxPoints <= 10000 AND AutoPoints BETWEEN 0 AND MaxPoints"));
            entity.HasIndex("ExamAttemptId", "QuestionId").IsUnique();
        });
        model.Entity("AeppGenerator.Api.Assessment.GradeRevision", entity => {
            entity.Property<Guid>("Id").HasColumnType("TEXT").ValueGeneratedOnAdd();
            entity.Property<Guid>("ExamAttemptId").HasColumnType("TEXT");
            entity.Property<string>("TeacherId").IsRequired().HasColumnType("TEXT");
            entity.Property<long>("RevisedScore").HasColumnType("INTEGER");
            entity.Property<string>("TeacherComments").IsRequired().HasColumnType("TEXT").HasMaxLength(5000);
            entity.Property<DateTime>("RevisedAt").HasColumnType("TEXT");
            entity.Property<int>("Version").HasColumnType("INTEGER");
            entity.HasKey("Id");
            entity.ToTable("GradeRevisions", table => table.HasCheckConstraint("CK_Revision_Score", "RevisedScore BETWEEN 0 AND 10000"));
            entity.HasIndex("ExamAttemptId", "Version").IsUnique(); entity.HasIndex("TeacherId");
        });
        model.Entity("AeppGenerator.Api.Assessment.Exam", entity => entity.HasOne("AeppGenerator.Api.Assessment.AssessmentUser", "CreatedBy").WithMany().HasForeignKey("CreatedByUserId").OnDelete(DeleteBehavior.Restrict));
        model.Entity("AeppGenerator.Api.Assessment.ExamAttempt", entity => { entity.HasOne("AeppGenerator.Api.Assessment.AssessmentUser", "User").WithMany().HasForeignKey("UserId").OnDelete(DeleteBehavior.Restrict).IsRequired(); entity.HasOne("AeppGenerator.Api.Assessment.Exam", "Exam").WithMany().HasForeignKey("ExamId").OnDelete(DeleteBehavior.Restrict).IsRequired(); });
        model.Entity("AeppGenerator.Api.Assessment.QuestionSubmission", entity => entity.HasOne("AeppGenerator.Api.Assessment.ExamAttempt", "ExamAttempt").WithMany("QuestionSubmissions").HasForeignKey("ExamAttemptId").OnDelete(DeleteBehavior.Cascade).IsRequired());
        model.Entity("AeppGenerator.Api.Assessment.GradeRevision", entity => { entity.HasOne("AeppGenerator.Api.Assessment.ExamAttempt", "ExamAttempt").WithMany("GradeRevisions").HasForeignKey("ExamAttemptId").OnDelete(DeleteBehavior.Cascade).IsRequired(); entity.HasOne("AeppGenerator.Api.Assessment.AssessmentUser", "Teacher").WithMany().HasForeignKey("TeacherId").OnDelete(DeleteBehavior.Restrict).IsRequired(); });
    }
}
