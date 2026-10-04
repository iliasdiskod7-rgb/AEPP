using AeppGenerator.Domain.Enums;
using MediatR;

namespace AeppGenerator.Application.Exams;

public sealed record GenerateExamCommand(
    string Title, string AcademicYear, string TargetTopic,
    Difficulty Difficulty = Difficulty.Medium) : IRequest<ExamDto>;
