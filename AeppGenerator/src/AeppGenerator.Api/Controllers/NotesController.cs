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
public sealed record CodeNoteDto(Guid Id, string Title, string Code, string? Comment, DateTime CreatedAt, DateTime UpdatedAt, bool IsPublic = false, string AuthorName = "");
public sealed record SharedCodeNoteDto(string Title,string Code,string? Comment,DateTime CreatedAt,DateTime UpdatedAt,string AuthorName);

[ApiController, Authorize, Route("api/notes")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
[RequestSizeLimit(700_000)]
public sealed class NotesController(AssessmentDbContext db,IConfiguration configuration) : ControllerBase
{
    private IQueryable<CodeNote> Owned => db.CodeNotes.Where(note => note.UserId == AuthService.UserId(User));
    private static CodeNoteDto Dto(CodeNote note) => new(note.Id, note.Title, note.Code, note.Comment, note.CreatedAt, note.UpdatedAt,note.IsPublic,note.User?.FullName??"");
    private static bool Valid(SaveCodeNoteRequest request) => !string.IsNullOrWhiteSpace(request.Title) && !string.IsNullOrWhiteSpace(request.Code);

    [HttpGet]
    public async Task<ActionResult<List<CodeNoteDto>>> List(CancellationToken ct)
        => Ok(await Owned.AsNoTracking().OrderByDescending(note => note.UpdatedAt).ThenBy(note => note.Id)
            .Select(note => new CodeNoteDto(note.Id, note.Title, note.Code, note.Comment, note.CreatedAt, note.UpdatedAt,note.IsPublic,note.User.FullName)).ToListAsync(ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CodeNoteDto>> Get(Guid id, CancellationToken ct)
    {
        var note = await Owned.Include(note=>note.User).AsNoTracking().SingleOrDefaultAsync(note => note.Id == id, ct);
        return note is null ? NotFound() : Ok(Dto(note));
    }

    [HttpPost]
    public async Task<ActionResult<CodeNoteDto>> Create(SaveCodeNoteRequest request, CancellationToken ct)
    {
        if (!Valid(request)) return BadRequest(new { message = "Συμπλήρωσε τίτλο και κώδικα για τη σημείωση." });
        var now = DateTime.UtcNow;
        var note = new CodeNote { Id = Guid.NewGuid(), UserId = AuthService.UserId(User), Title = request.Title.Trim(), Code = request.Code, Comment = request.Comment, CreatedAt = now, UpdatedAt = now };
        db.CodeNotes.Add(note); await db.SaveChangesAsync(ct);
        await db.Entry(note).Reference(item=>item.User).LoadAsync(ct);
        return CreatedAtAction(nameof(Get), new { id = note.Id }, Dto(note));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CodeNoteDto>> Update(Guid id, SaveCodeNoteRequest request, CancellationToken ct)
    {
        var note = await Owned.Include(note=>note.User).SingleOrDefaultAsync(note => note.Id == id, ct);
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

    [HttpPost("{id:guid}/share")]
    public async Task<IActionResult> Share(Guid id,CancellationToken ct) {
        var owned=Owned.Where(note=>note.Id==id);
        if(!await owned.AnyAsync(ct))return NotFound();
        var token=Guid.NewGuid().ToString("N");
        // Conditional update ensures concurrent requests return the same stable token.
        await owned.Where(note=>note.ShareToken==null).ExecuteUpdateAsync(set=>set.SetProperty(note=>note.ShareToken,token).SetProperty(note=>note.IsPublic,true),ct);
        await owned.Where(note=>!note.IsPublic).ExecuteUpdateAsync(set=>set.SetProperty(note=>note.IsPublic,true),ct);
        var shared=await owned.AsNoTracking().SingleOrDefaultAsync(ct);
        if(shared is null)return NotFound();
        var origins=(configuration["Auth:FrontendOrigins"]??"http://localhost:5173,http://127.0.0.1:5173").Split(',',StringSplitOptions.TrimEntries|StringSplitOptions.RemoveEmptyEntries);
        var origin=Request.Headers.Origin.ToString();
        var baseUrl=configuration["Notes:PublicBaseUrl"]??(origins.Contains(origin,StringComparer.OrdinalIgnoreCase)?origin:origins.First());
        return Ok(new {url=baseUrl.TrimEnd('/')+"/share/"+shared.ShareToken});
    }

    [HttpDelete("{id:guid}/share")]
    public async Task<IActionResult> Unshare(Guid id,CancellationToken ct)=>
        await Owned.Where(note=>note.Id==id).ExecuteUpdateAsync(set=>set.SetProperty(note=>note.IsPublic,false).SetProperty(note=>note.ShareToken,(string?)null),ct)==0?NotFound():NoContent();

    [AllowAnonymous,HttpGet("shared/{shareToken}")]
    public async Task<IActionResult> Shared(string shareToken,CancellationToken ct) {
        if(!Guid.TryParseExact(shareToken,"N",out _))return NotFound();
        var note=await db.CodeNotes.AsNoTracking().Where(note=>note.IsPublic&&note.ShareToken==shareToken)
            .Select(note=>new SharedCodeNoteDto(note.Title,note.Code,note.Comment,note.CreatedAt,note.UpdatedAt,note.User.FullName)).SingleOrDefaultAsync(ct);
        return note is null?NotFound():Ok(note);
    }
}
