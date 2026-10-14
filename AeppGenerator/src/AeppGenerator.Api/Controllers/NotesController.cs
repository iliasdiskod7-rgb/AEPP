using System.ComponentModel.DataAnnotations;
using AeppGenerator.Api.Auth;
using AeppGenerator.Api.Data;
using AeppGenerator.Api.Notes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AeppGenerator.Api.Controllers;

public sealed record SaveCodeNoteRequest
{
    [Required, StringLength(200)] public required string Title { get; init; }
    [Required, StringLength(100000)] public required string Code { get; init; }
    [StringLength(5000)] public string? Comment { get; init; }
    public DateTime? ExpectedUpdatedAt { get; init; }
}
public sealed record CodeNoteDto(Guid Id, string Title, string Code, string? Comment, DateTime CreatedAt, DateTime UpdatedAt);

[ApiController, Authorize, Route("api/notes")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
[RequestSizeLimit(700_000)]
public sealed class NotesController(AssessmentDbContext db) : ControllerBase
{
    private IQueryable<CodeNote> Owned => db.CodeNotes.Where(note => note.UserId == AuthService.UserId(User));
    private static CodeNoteDto Dto(CodeNote note) => new(note.Id, note.Title, note.Code, note.Comment, note.CreatedAt, note.UpdatedAt);
    private static bool Valid(SaveCodeNoteRequest request) => !string.IsNullOrWhiteSpace(request.Title) && !string.IsNullOrWhiteSpace(request.Code);

    [HttpGet]
    public async Task<ActionResult<List<CodeNoteDto>>> List(CancellationToken ct)
        => Ok(await Owned.AsNoTracking().OrderByDescending(note => note.UpdatedAt).ThenBy(note => note.Id)
            .Select(note => new CodeNoteDto(note.Id, note.Title, note.Code, note.Comment, note.CreatedAt, note.UpdatedAt)).ToListAsync(ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CodeNoteDto>> Get(Guid id, CancellationToken ct)
    {
        var note = await Owned.AsNoTracking().SingleOrDefaultAsync(note => note.Id == id, ct);
        return note is null ? NotFound() : Ok(Dto(note));
    }

    [HttpPost]
    public async Task<ActionResult<CodeNoteDto>> Create(SaveCodeNoteRequest request, CancellationToken ct)
    {
        if (!Valid(request)) return BadRequest(new { message = "Συμπλήρωσε τίτλο και κώδικα για τη σημείωση." });
        var now = DateTime.UtcNow;
        var note = new CodeNote { Id = Guid.NewGuid(), UserId = AuthService.UserId(User), Title = request.Title.Trim(), Code = request.Code, Comment = request.Comment, CreatedAt = now, UpdatedAt = now };
        db.CodeNotes.Add(note); await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Get), new { id = note.Id }, Dto(note));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CodeNoteDto>> Update(Guid id, SaveCodeNoteRequest request, CancellationToken ct)
    {
        var note = await Owned.SingleOrDefaultAsync(note => note.Id == id, ct);
        if (note is null) return NotFound();
        if (!Valid(request)) return BadRequest(new { message = "Συμπλήρωσε τίτλο και κώδικα για τη σημείωση." });
        if (request.ExpectedUpdatedAt.HasValue && request.ExpectedUpdatedAt.Value.ToUniversalTime() != note.UpdatedAt)
            return Conflict(new { message = "Η σημείωση άλλαξε από άλλη καρτέλα. Άνοιξέ την ξανά πριν την ενημέρωση." });
        note.Title = request.Title.Trim(); note.Code = request.Code; note.Comment = request.Comment;
        note.UpdatedAt = DateTime.UtcNow > note.UpdatedAt ? DateTime.UtcNow : note.UpdatedAt.AddTicks(1);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "Η σημείωση ενημερώθηκε ή διαγράφηκε. Άνοιξέ την ξανά." }); }
        return Ok(Dto(note));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => await Owned.Where(note => note.Id == id).ExecuteDeleteAsync(ct) == 0 ? NotFound() : NoContent();
}
