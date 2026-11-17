using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
namespace AeppGenerator.Api.Data.Migrations;

[DbContext(typeof(AssessmentDbContext))]
[Migration("202610150001_AddNoteSharing")]
public sealed class AddNoteSharing:Migration {
 protected override void BuildTargetModel(ModelBuilder model)=>SharedCodeNotesSnapshot.Configure(model);
 protected override void Up(MigrationBuilder migration) {
  migration.AddColumn<bool>("IsPublic","CodeNotes",type:"INTEGER",nullable:false,defaultValue:false);
  migration.AddColumn<string>("ShareToken","CodeNotes",type:"TEXT",maxLength:32,nullable:true);
  migration.CreateIndex("IX_CodeNotes_ShareToken","CodeNotes","ShareToken",unique:true,filter:"\"ShareToken\" IS NOT NULL");
 }
 protected override void Down(MigrationBuilder migration) {
  migration.DropIndex("IX_CodeNotes_ShareToken","CodeNotes");
  migration.DropColumn("ShareToken","CodeNotes");migration.DropColumn("IsPublic","CodeNotes");
 }
}
internal static class SharedCodeNotesSnapshot {
 internal static void Configure(ModelBuilder model) {
  CodeNotesSnapshot.Configure(model);
  model.Entity("AeppGenerator.Api.Notes.CodeNote",entity=> {
   entity.Property<bool>("IsPublic").ValueGeneratedOnAdd().HasColumnType("INTEGER").HasDefaultValue(false);
   entity.Property<string?>("ShareToken").HasMaxLength(32).HasColumnType("TEXT");
   entity.HasIndex("ShareToken").IsUnique().HasFilter("\"ShareToken\" IS NOT NULL");
  });
 }
}
