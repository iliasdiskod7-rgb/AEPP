using System.ComponentModel.DataAnnotations;

namespace AeppGenerator.Application.Exams;

/// <summary>Μετρικά εκτέλεσης που καταγράφηκαν από τον διερμηνευτή.</summary>
public sealed record CodeReviewMetrics
{
    [Range(0, 10_000_000)]
    public required int ComparisonsCount { get; init; }

    [Range(0, 10_000_000)]
    public required int AssignmentsCount { get; init; }

    [Range(0, 10_000_000)]
    public required int LoopIterations { get; init; }
}

/// <summary>Αίτημα αξιολόγησης κώδικα και μετρικών εκτέλεσης.</summary>
public sealed record CodeReviewRequest
{
    [Required, StringLength(12_000, MinimumLength = 1)]
    public required string StudentCode { get; init; }

    [Required]
    public required CodeReviewMetrics Metrics { get; init; }
}

/// <summary>Δομημένη ανατροφοδότηση για κώδικα ΓΛΩΣΣΑΣ.</summary>
public sealed record CodeReviewResponse(
    string Efficiency,
    string AlgorithmicRisks,
    string StyleAndAeppRules);
