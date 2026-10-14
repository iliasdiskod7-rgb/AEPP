using System.Text.Json;
using AeppGenerator.Api.Assessment;
using AeppGenerator.Api.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AeppGenerator.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/exams/attempts")]
public sealed class ExamAttemptsController(ExamAttemptService attempts) : ControllerBase
{
    /// <summary>Returns one bank exam with answer keys and hidden test inputs withheld.</summary>
    [HttpGet("/api/exams/random")]
    [ProducesResponseType(typeof(RandomExamResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RandomExamResponse>> Random(CancellationToken ct)
    {
        var exam = await attempts.GetRandomPracticeExam(ct);
        return exam is null ? NotFound() : Ok(exam);
    }

    [HttpPost("start")]
    [RequestSizeLimit(1000000)]
    public Task<IActionResult> Start(StartAttemptRequest request, CancellationToken ct) =>
        Execute(async () => StatusCode(201, await attempts.Start(AuthService.UserId(User), request, ct)));

    [HttpPost("submit")]
    [RequestSizeLimit(1000000)]
    public Task<IActionResult> Submit(SubmitAttemptRequest request, CancellationToken ct) =>
        Execute(async () => Ok(await attempts.Submit(AuthService.UserId(User), request, ct)));

    [HttpGet("my-history")]
    public Task<IActionResult> MyHistory(CancellationToken ct, int page = 1, int pageSize = 20) =>
        Execute(async () => Ok(await attempts.History(AuthService.UserId(User), false, page, pageSize, ct)));

    [HttpGet("review-history")]
    [Authorize(Roles = "TEACHER")]
    public Task<IActionResult> ReviewHistory(CancellationToken ct, int page = 1, int pageSize = 20) =>
        Execute(async () => Ok(await attempts.History(AuthService.UserId(User), true, page, pageSize, ct)));

    [HttpGet("{attemptId:guid}")]
    public Task<IActionResult> Get(Guid attemptId, CancellationToken ct) =>
        Execute(async () => Ok(await attempts.Get(attemptId, AuthService.UserId(User), User.IsInRole("TEACHER"), ct)));

    [HttpPost("{attemptId:guid}/grade")]
    [RequestSizeLimit(20000)]
    [Authorize(Roles = "TEACHER")]
    public Task<IActionResult> Grade(Guid attemptId, GradeAttemptRequest request, CancellationToken ct) =>
        Execute(async () => Ok(await attempts.Grade(AuthService.UserId(User), attemptId, request, ct)));

    private async Task<IActionResult> Execute(Func<Task<IActionResult>> action)
    {
        try { return await action(); }
        catch (AttemptNotFoundException) { return NotFound(new { message = "Η προσπάθεια ή το διαγώνισμα δεν βρέθηκε." }); }
        catch (AttemptConflictException error) { return Conflict(new { message = error.Message }); }
        catch (JsonException) { return BadRequest(new { message = "Μη έγκυρη δομή JSON στην υποβολή." }); }
        catch (ArgumentException error) { return BadRequest(new { message = error.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }
}
