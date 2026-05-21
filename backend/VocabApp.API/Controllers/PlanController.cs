using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VocabApp.API.Data;
using VocabApp.API.DTOs;
using VocabApp.API.Extensions;
using VocabApp.API.Services;

namespace VocabApp.API.Controllers;

[ApiController]
[Route("api/plan")]
[Authorize]
public class PlanController(AppDbContext db) : ControllerBase
{
    // GET /api/plan/weekly?from=2026-05-18 — Mon–Sun of the week containing `from` (defaults to current week)
    [HttpGet("weekly")]
    public async Task<IActionResult> GetWeeklyPlan([FromQuery] string? from)
    {
        var userId = User.GetUserId();
        DateOnly anchor;
        if (from != null && DateOnly.TryParse(from, out var parsed))
            anchor = parsed;
        else
            anchor = DateOnly.FromDateTime(DateTime.UtcNow);

        var dow = (int)anchor.DayOfWeek;
        var monday = anchor.AddDays(dow == 0 ? -6 : -(dow - 1));
        return Ok(await BuildPlan(userId, monday, 7));
    }

    // GET /api/plan/monthly?from=2026-05-01 — all days in the calendar month containing `from`
    [HttpGet("monthly")]
    public async Task<IActionResult> GetMonthlyPlan([FromQuery] string? from)
    {
        var userId = User.GetUserId();
        DateOnly anchor;
        if (from != null && DateOnly.TryParse(from, out var parsed))
            anchor = parsed;
        else
            anchor = DateOnly.FromDateTime(DateTime.UtcNow);

        var firstDay = new DateOnly(anchor.Year, anchor.Month, 1);
        var daysInMonth = DateTime.DaysInMonth(anchor.Year, anchor.Month);
        return Ok(await BuildPlan(userId, firstDay, daysInMonth));
    }

    // PATCH /api/plan/{setId}/reschedule — move NextReviewAt to a different date
    [HttpPatch("{setId:guid}/reschedule")]
    public async Task<IActionResult> RescheduleSet(Guid setId, [FromBody] RescheduleRequest req)
    {
        if (!DateOnly.TryParse(req.Date, out var targetDate))
            return BadRequest("Invalid date format. Use yyyy-MM-dd.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (targetDate < today)
            return BadRequest("Cannot reschedule to a past date.");

        var userId = User.GetUserId();
        var progress = await db.SetProgress
            .FirstOrDefaultAsync(p => p.UserId == userId && p.SetId == setId);

        if (progress == null) return NotFound();
        if (progress.ReviewStage == 0 || progress.ReviewStage >= 6)
            return BadRequest("Cannot reschedule a completed or reset set.");

        progress.NextReviewAt = targetDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        await db.SaveChangesAsync();
        return Ok();
    }

    private async Task<List<PlanDayDto>> BuildPlan(Guid userId, DateOnly from, int days)
    {
        var todayUtc = DateOnly.FromDateTime(DateTime.UtcNow);
        var fromDt = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toDt = from.AddDays(days - 1).ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        // Include overdue sets (NextReviewAt < from) so they appear on today's date.
        // Overdue = NextReviewAt is before the start of the range but still within grace period.
        var overdueFromDt = todayUtc.AddDays(-(ReviewScheduler.GracePeriodDays)).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var items = await db.SetProgress
            .Where(p => p.UserId == userId &&
                        p.NextReviewAt.HasValue &&
                        p.NextReviewAt.Value >= overdueFromDt &&
                        p.NextReviewAt.Value <= toDt &&
                        p.ReviewStage > 0 && p.ReviewStage < 6)
            .Join(db.WordSets,
                  p => p.SetId,
                  s => s.Id,
                  (p, s) => new { p.NextReviewAt, SetId = s.Id, s.Title, p.TotalWords })
            .ToListAsync();

        // Overdue sets (NextReviewAt < today) are placed on today's date.
        var grouped = items
            .GroupBy(x =>
            {
                var scheduledDate = DateOnly.FromDateTime(x.NextReviewAt!.Value);
                return scheduledDate < todayUtc ? todayUtc : scheduledDate;
            })
            .ToDictionary(
                g => g.Key,
                g => g.Select(x =>
                {
                    var scheduledDate = DateOnly.FromDateTime(x.NextReviewAt!.Value);
                    var isOverdue = scheduledDate < todayUtc;
                    var graceDaysLeft = isOverdue
                        ? ReviewScheduler.GracePeriodDays - (todayUtc.DayNumber - scheduledDate.DayNumber)
                        : 0;
                    return new PlanSetItemDto(x.SetId, x.Title, x.TotalWords, isOverdue, graceDaysLeft);
                }).ToList());

        return Enumerable.Range(0, days)
            .Select(i =>
            {
                var date = from.AddDays(i);
                var sets = grouped.GetValueOrDefault(date, []);
                return new PlanDayDto(date.ToDateTime(TimeOnly.MinValue), sets.Sum(s => s.TotalWords), sets);
            })
            .ToList();
    }
}
