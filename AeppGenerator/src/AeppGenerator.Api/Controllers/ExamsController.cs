using AeppGenerator.Application.Abstractions;
using AeppGenerator.Application.Exams;
using AeppGenerator.Application.Llm;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using AeppGenerator.Api.Auth;
using AeppGenerator.Api.Data;
using System.Text.Json;
using System.Net;

namespace AeppGenerator.Api.Controllers;

[ApiController, Authorize(Roles="TEACHER")]
[Route("api/[controller]")]
public sealed class ExamsController(ILlmExamGeneratorService generator, AccountStore accounts) : ControllerBase
{
    // Το FallbackExamGeneratorService επιστρέφει ExamDto / HTTP 200 μετά από προσωρινές αποτυχίες.
    // generationSource = examBank ενεργοποιεί το ενημερωτικό toast στον client.
    [HttpPost("generate")]
    [ProducesResponseType(typeof(ExamDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status502BadGateway)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status504GatewayTimeout)]
    public async Task<ActionResult<ExamDto>> Generate(
        [FromBody] GenerateExamRequest request, CancellationToken ct)
    {
        try
        {
            var exam = await generator.GenerateExamAsync(request, ct);
            accounts.SaveExam(AuthService.UserId(User), exam.Title, "examDto", JsonSerializer.Serialize(exam, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
            return Ok(exam);
        }
        catch (ArgumentException ex)
        {
            return Problem(statusCode: 400, title: "Μη έγκυρες επιλογές διαγωνίσματος", detail: ex.Message);
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
            return Problem(statusCode: status, title: "Η παραγωγή διαγωνίσματος δεν ολοκληρώθηκε.",
                detail: ex.StatusCode.HasValue ? ex.Message : "Δεν ήταν δυνατή η ασφαλής σύνδεση του backend με το Gemini.");
        }
        catch (InvalidDataException)
        {
            return Problem(statusCode: 502, title: "Δεν ήταν δυνατή η παραγωγή έγκυρου διαγωνίσματος.");
        }
        catch (InvalidOperationException ex)
        {
            return Problem(statusCode: 503, title: "Η σύνδεση με το Gemini δεν έχει ρυθμιστεί.", detail: ex.Message);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return Problem(statusCode: 504, title: "Η παραγωγή ξεπέρασε τον διαθέσιμο χρόνο.");
        }
    }
}
