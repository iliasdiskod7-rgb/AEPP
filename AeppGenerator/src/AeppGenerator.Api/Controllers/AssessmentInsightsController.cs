using System.Net;
using AeppGenerator.Application.Abstractions;
using AeppGenerator.Application.Exams;
using Microsoft.AspNetCore.Mvc;

namespace AeppGenerator.Api.Controllers;

[ApiController]
[Route("api/exams/assessment-insight")]
public sealed class AssessmentInsightsController(IAssessmentInsightService insights) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(AssessmentInsightResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<AssessmentInsightResponse>> Generate(
        [FromBody] AssessmentInsightRequest request, CancellationToken ct)
    {
        try { return Ok(await insights.GenerateAsync(request, ct)); }
        catch (ArgumentException ex)
        {
            return Problem(statusCode: 400, title: "Μη έγκυρη αναφορά αξιολόγησης", detail: ex.Message);
        }
        catch (HttpRequestException ex)
        {
            var status = ex.StatusCode switch
            {
                HttpStatusCode.TooManyRequests => 429,
                HttpStatusCode.ServiceUnavailable => 503,
                HttpStatusCode.GatewayTimeout => 504,
                _ => 502
            };
            return Problem(statusCode: status, title: "Η ανάλυση με Gemini δεν ολοκληρώθηκε.", detail: ex.Message);
        }
        catch (InvalidDataException)
        {
            return Problem(statusCode: 502, title: "Το Gemini επέστρεψε μη έγκυρη ανάλυση.");
        }
        catch (InvalidOperationException ex)
        {
            return Problem(statusCode: 503, title: "Η σύνδεση με το Gemini δεν έχει ρυθμιστεί.", detail: ex.Message);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return Problem(statusCode: 504, title: "Η ανάλυση ξεπέρασε τον διαθέσιμο χρόνο.");
        }
    }
}
