namespace AeppGenerator.Api.Gamification;

// Deliberate allow-list: neither answer keys nor explanations are part of today's DTO.
public sealed record DailyChallengeDto(string Id, string Day, int DayIndex, string Topic,
 DateTimeOffset ServerNow, IReadOnlyList<DailyQuestionDto> Questions);
public sealed record DailyQuestionDto(string Id, string Type, string QuestionText,
 string? CodeSnippet, string? Declarations, IReadOnlyList<DailyBlankDto> Blanks);
public sealed record DailyBlankDto(string Id, IReadOnlyList<string> Options);
