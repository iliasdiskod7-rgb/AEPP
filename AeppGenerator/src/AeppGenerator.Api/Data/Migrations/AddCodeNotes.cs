using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace AeppGenerator.Api.Data.Migrations;

[DbContext(typeof(AssessmentDbContext))]
[Migration("202610120001_AddCodeNotes")]
public sealed class AddCodeNotes : Migration
{
    protected override void BuildTargetModel(ModelBuilder model) => CodeNotesSnapshot.Configure(model);
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
CREATE TABLE CodeNotes (
 Id TEXT NOT NULL PRIMARY KEY, UserId TEXT NOT NULL REFERENCES Users(Id) ON DELETE CASCADE,
 Title TEXT NOT NULL, Code TEXT NOT NULL, Comment TEXT NULL,
 CreatedAt TEXT NOT NULL, UpdatedAt TEXT NOT NULL,
 CONSTRAINT CK_CodeNote_Lengths CHECK(length(trim(Title)) BETWEEN 1 AND 200 AND length(Code) BETWEEN 1 AND 100000 AND (Comment IS NULL OR length(Comment) <= 5000))
);
CREATE INDEX IX_CodeNotes_UserId_UpdatedAt ON CodeNotes(UserId, UpdatedAt);
""");
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable("CodeNotes");
}

internal static class CodeNotesSnapshot
{
    internal static void Configure(ModelBuilder model)
    {
        InitialAssessmentModel.Configure(model);
        model.Entity("AeppGenerator.Api.Notes.CodeNote", entity => {
            entity.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("TEXT");
            entity.Property<string>("UserId").IsRequired().HasColumnType("TEXT");
            entity.Property<string>("Title").IsRequired().HasMaxLength(200).HasColumnType("TEXT");
            entity.Property<string>("Code").IsRequired().HasMaxLength(100000).HasColumnType("TEXT");
            entity.Property<string?>("Comment").HasMaxLength(5000).HasColumnType("TEXT");
            entity.Property<DateTime>("CreatedAt").HasColumnType("TEXT");
            entity.Property<DateTime>("UpdatedAt").IsConcurrencyToken().HasColumnType("TEXT");
            entity.HasKey("Id"); entity.HasIndex("UserId", "UpdatedAt");
            entity.ToTable("CodeNotes", table => table.HasCheckConstraint("CK_CodeNote_Lengths", "length(trim(Title)) BETWEEN 1 AND 200 AND length(Code) BETWEEN 1 AND 100000 AND (Comment IS NULL OR length(Comment) <= 5000)"));
            entity.HasOne("AeppGenerator.Api.Assessment.AssessmentUser", "User").WithMany().HasForeignKey("UserId").OnDelete(DeleteBehavior.Cascade).IsRequired();
        });
    }
}
