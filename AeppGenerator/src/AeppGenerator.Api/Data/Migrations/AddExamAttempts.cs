using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace AeppGenerator.Api.Data.Migrations;

[DbContext(typeof(AssessmentDbContext))]
[Migration("202610110001_AddExamAttempts")]
public sealed class AddExamAttempts : Migration
{
    protected override void BuildTargetModel(ModelBuilder model) => InitialAssessmentModel.Configure(model);

    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
CREATE TABLE Exams (
 Id TEXT NOT NULL PRIMARY KEY, Title TEXT NOT NULL, Source TEXT NOT NULL,
 CreatedByUserId TEXT NULL REFERENCES Users(Id) ON DELETE RESTRICT,
 DefinitionJson TEXT NOT NULL, CreatedAt TEXT NOT NULL
);
CREATE INDEX IX_Exams_CreatedByUserId ON Exams(CreatedByUserId);
CREATE TABLE ExamAttempts (
 Id TEXT NOT NULL PRIMARY KEY, UserId TEXT NOT NULL REFERENCES Users(Id) ON DELETE RESTRICT,
 ExamId TEXT NOT NULL REFERENCES Exams(Id) ON DELETE RESTRICT,
 StartedAt TEXT NOT NULL, SubmittedAt TEXT NULL,
 AutoGradeScore INTEGER NOT NULL, FinalScore INTEGER NOT NULL,
 Status TEXT NOT NULL, Version INTEGER NOT NULL, SubmissionHash TEXT NULL, ReportJson TEXT NOT NULL,
 CONSTRAINT CK_Attempt_Scores CHECK(AutoGradeScore BETWEEN 0 AND 10000 AND FinalScore BETWEEN 0 AND 10000),
 CONSTRAINT CK_Attempt_Status CHECK(Status IN ('IN_PROGRESS','SUBMITTED','GRADED_BY_TEACHER')),
 CONSTRAINT CK_Attempt_Submitted CHECK((Status = 'IN_PROGRESS' AND SubmittedAt IS NULL) OR (Status <> 'IN_PROGRESS' AND SubmittedAt IS NOT NULL))
);
CREATE INDEX IX_ExamAttempts_UserId_StartedAt ON ExamAttempts(UserId,StartedAt);
CREATE INDEX IX_ExamAttempts_Status_SubmittedAt ON ExamAttempts(Status,SubmittedAt);
CREATE INDEX IX_ExamAttempts_ExamId ON ExamAttempts(ExamId);
CREATE TABLE QuestionSubmissions (
 Id TEXT NOT NULL PRIMARY KEY, ExamAttemptId TEXT NOT NULL REFERENCES ExamAttempts(Id) ON DELETE CASCADE,
 QuestionId TEXT NOT NULL, Theme TEXT NOT NULL, QuestionCode TEXT NOT NULL, Position INTEGER NOT NULL,
 StudentAnswerJson TEXT NOT NULL, TestResultsJson TEXT NOT NULL, AutoPoints INTEGER NOT NULL, MaxPoints INTEGER NOT NULL,
 CONSTRAINT CK_Question_Scores CHECK(MaxPoints > 0 AND MaxPoints <= 10000 AND AutoPoints BETWEEN 0 AND MaxPoints)
);
CREATE UNIQUE INDEX IX_QuestionSubmissions_ExamAttemptId_QuestionId ON QuestionSubmissions(ExamAttemptId,QuestionId);
CREATE TABLE GradeRevisions (
 Id TEXT NOT NULL PRIMARY KEY, ExamAttemptId TEXT NOT NULL REFERENCES ExamAttempts(Id) ON DELETE CASCADE,
 TeacherId TEXT NOT NULL REFERENCES Users(Id) ON DELETE RESTRICT,
 RevisedScore INTEGER NOT NULL, TeacherComments TEXT NOT NULL, RevisedAt TEXT NOT NULL, Version INTEGER NOT NULL,
 CONSTRAINT CK_Revision_Score CHECK(RevisedScore BETWEEN 0 AND 10000)
);
CREATE UNIQUE INDEX IX_GradeRevisions_ExamAttemptId_Version ON GradeRevisions(ExamAttemptId,Version);
CREATE INDEX IX_GradeRevisions_TeacherId ON GradeRevisions(TeacherId);
""");

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("GradeRevisions");
        migrationBuilder.DropTable("QuestionSubmissions");
        migrationBuilder.DropTable("ExamAttempts");
        migrationBuilder.DropTable("Exams");
    }
}
