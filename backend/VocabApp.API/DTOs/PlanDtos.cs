namespace VocabApp.API.DTOs;

public record PlanSetItemDto(Guid SetId, string Title, int TotalWords, bool IsOverdue, int GraceDaysLeft, bool IsProjected = false);
public record PlanDayDto(DateTime Date, int TotalWords, List<PlanSetItemDto> Sets);
public record RescheduleRequest(string Date);
