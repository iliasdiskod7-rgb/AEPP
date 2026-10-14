using System.Net;
using AeppGenerator.Api.Security;
using AeppGenerator.Application.Abstractions;
using AeppGenerator.Application.Exams;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AeppGenerator.Api.Controllers;

[ApiController]
[Authorize]
[EnableRateLimiting(ApiRateLimiting.AiInsightsPolicy)]
[Route("api/code-review")]
public sealed class CodeReviewController(ICodeReviewService codeReview) : ControllerBase
{
    /// <summary>Δημιουργεί δομημένη ανατροφοδότηση για κώδικα και μετρικά εκτέλεσης.</summary>
    [HttpPost]
    [RequestSizeLimit(64 * 1024)]
    [ProducesResponseType(typeof(CodeReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    [ProducesResponseType(StatusCodes.Status504GatewayTimeout)]
    public async Task<ActionResult<CodeReviewResponse>> Review(
        [FromBody] CodeReviewRequest request, CancellationToken cancellationToken)
    {
        try { return Ok(await codeReview.ReviewAsync(request, cancellationToken)); }
        catch (ArgumentException ex)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest,
                title: "Μη έγκυρα στοιχεία αξιολόγησης κώδικα.", detail: ex.Message);
        }
        catch (HttpRequestException ex)
        {
            var status = ex.StatusCode switch
            {
                HttpStatusCode.TooManyRequests => StatusCodes.Status429TooManyRequests,
                HttpStatusCode.ServiceUnavailable => StatusCodes.Status503ServiceUnavailable,
                HttpStatusCode.GatewayTimeout => StatusCodes.Status504GatewayTimeout,
                _ => StatusCodes.Status502BadGateway
            };
            return Problem(statusCode: status, title: "Η αξιολόγηση κώδικα με Gemini δεν ολοκληρώθηκε. Δοκιμάστε ξανά σε λίγο.");
        }
        catch (InvalidDataException)
        {
            return Problem(statusCode: StatusCodes.Status502BadGateway,
                title: "Το Gemini επέστρεψε μη έγκυρη αξιολόγηση κώδικα.");
        }
        catch (InvalidOperationException)
        {
            return Problem(statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Η υπηρεσία αξιολόγησης είναι προσωρινά μη διαθέσιμη.");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return Problem(statusCode: StatusCodes.Status504GatewayTimeout,
                title: "Η αξιολόγηση κώδικα ξεπέρασε τον διαθέσιμο χρόνο.");
        }
    }
}
