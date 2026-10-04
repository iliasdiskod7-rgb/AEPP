using AeppGenerator.Application.Abstractions;
using AeppGenerator.Application.Exams;
using AeppGenerator.Application.Llm;
using Microsoft.AspNetCore.Mvc;

namespace AeppGenerator.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ExamsController(ILlmExamGeneratorService generator) : ControllerBase
{
    [HttpPost("generate")]
    [ProducesResponseType(typeof(ExamDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status502BadGateway)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status504GatewayTimeout)]
    public async Task<ActionResult<ExamDto>> Generate(
        [FromBody] GenerateExamRequest request, CancellationToken ct)
    {
        try
        {
            return Ok(await generator.GenerateExamAsync(request, ct));
        }
        catch (ArgumentException ex)
        {
            return Problem(statusCode: 400, title: "Μη έγκυρες επιλογές διαγωνίσματος", detail: ex.Message);
        }
        catch (HttpRequestException)
        {
            return Problem(statusCode: 502, title: "Η υπηρεσία παραγωγής δεν είναι διαθέσιμη.");
        }
        catch (InvalidDataException)
        {
            return Problem(statusCode: 502, title: "Δεν ήταν δυνατή η παραγωγή έγκυρου διαγωνίσματος.");
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return Problem(statusCode: 504, title: "Η παραγωγή ξεπέρασε τον διαθέσιμο χρόνο.");
        }
    }
}
