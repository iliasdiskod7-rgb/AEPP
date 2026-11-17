using AeppGenerator.Api.Assessment;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace AeppGenerator.Api.Notes;

public sealed class CodeNote
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public AssessmentUser User { get; set; } = null!;
    public string Title { get; set; } = "";
    public string Code { get; set; } = "";
    public string? Comment { get; set; }
    public bool IsPublic { get; set; }
    public string? ShareToken { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

internal static class CodeNoteModel
{
    internal static void Configure(ModelBuilder model)
    {
        var utc = new ValueConverter<DateTime, DateTime>(value => value, value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
        model.Entity<CodeNote>(entity => {
            entity.ToTable("CodeNotes", table => table.HasCheckConstraint("CK_CodeNote_Lengths", "length(trim(Title)) BETWEEN 1 AND 200 AND length(Code) BETWEEN 1 AND 100000 AND (Comment IS NULL OR length(Comment) <= 5000)"));
            entity.HasKey(note => note.Id);
            entity.Property(note => note.Title).IsRequired().HasMaxLength(200);
            entity.Property(note => note.Code).IsRequired().HasMaxLength(100000);
            entity.Property(note => note.IsPublic).HasDefaultValue(false);
            entity.Property(note => note.ShareToken).HasMaxLength(32);
            entity.HasIndex(note => note.ShareToken).IsUnique().HasFilter("\"ShareToken\" IS NOT NULL");
            entity.Property(note => note.Comment).HasMaxLength(5000);
            entity.Property(note => note.CreatedAt).HasConversion(utc);
            entity.Property(note => note.UpdatedAt).HasConversion(utc).IsConcurrencyToken();
            entity.HasOne(note => note.User).WithMany().HasForeignKey(note => note.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(note => new { note.UserId, note.UpdatedAt });
        });
    }
}
