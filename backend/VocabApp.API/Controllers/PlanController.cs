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

    // GET /api/plan/monthly?from=2026-05-25 — 30 days starting from `from` (defaults to today)
    [HttpGet("monthly")]
    public async Task<IActionResult> GetMonthlyPlan([FromQuery] string? from)
    {
        var userId = User.GetUserId();
        DateOnly anchor;
        if (from != null && DateOnly.TryParse(from, out var parsed))
            anchor = parsed;
        else
            anchor = DateOnly.FromDateTime(DateTime.UtcNow);

        return Ok(await BuildPlan(userId, anchor, 30));
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
        var rangeTo = from.AddDays(days - 1);

        // Fetch all active progress records for this user.
        // For confirmed entries (NextReviewAt within range or overdue within grace period)
        // and projected entries (future stages computed from Intervals), we need all active records.
        var overdueFromDt = todayUtc.AddDays(-ReviewScheduler.GracePeriodDays)
                                    .ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var records = await db.SetProgress
            .Where(p => p.UserId == userId &&
                        p.NextReviewAt.HasValue &&
                        p.ReviewStage > 0 && p.ReviewStage < 6)
            .Join(db.WordSets,
                  p => p.SetId,
                  s => s.Id,
                  (p, s) => new { p.NextReviewAt, p.ReviewStage, SetId = s.Id, s.Title, p.TotalWords })
            .ToListAsync();

        // Build a lookup: date → list of items
        var grouped = new Dictionary<DateOnly, List<PlanSetItemDto>>();

        void AddItem(DateOnly date, PlanSetItemDto item)
        {
            if (date < from || date > rangeTo) return;
            if (!grouped.TryGetValue(date, out var list))
                grouped[date] = list = [];
            list.Add(item);
        }

        foreach (var r in records)
        {
            var scheduledDate = DateOnly.FromDateTime(r.NextReviewAt!.Value);
            var isFinalStage = r.ReviewStage == ReviewScheduler.FinalStage;

            // Stage 5 is exempt from grace period and expiry — it can be completed at any time.
            var isOverdue = !isFinalStage && scheduledDate < todayUtc && scheduledDate >= todayUtc.AddDays(-ReviewScheduler.GracePeriodDays);
            var isExpired = !isFinalStage && scheduledDate < todayUtc.AddDays(-ReviewScheduler.GracePeriodDays);

            if (isExpired) continue; // expired sets are reset, don't show

            // ── Confirmed next review ──────────────────────────────────────────
            // For overdue sets: pin to today. For final stage: show on scheduled date (or today if past).
            var confirmedDate = (isOverdue || (isFinalStage && scheduledDate < todayUtc)) ? todayUtc : scheduledDate;
            var graceDaysLeft = isOverdue
                ? ReviewScheduler.GracePeriodDays - (todayUtc.DayNumber - scheduledDate.DayNumber)
                : 0;
            AddItem(confirmedDate, new PlanSetItemDto(r.SetId, r.Title, r.TotalWords, isOverdue, graceDaysLeft, IsProjected: false, ReviewStage: r.ReviewStage));

            // ── Projected future stages ────────────────────────────────────────
            // Starting from the confirmed date, accumulate intervals for each remaining stage.
            // Intervals[newStage - 1] is added after completing the current stage.
            var projectedDate = scheduledDate; // project from scheduled (not overdue-shifted) date
            for (int nextStage = r.ReviewStage + 1; nextStage <= ReviewScheduler.Intervals.Length; nextStage++)
            {
                projectedDate = projectedDate.AddDays(ReviewScheduler.Intervals[nextStage - 1]);
                if (projectedDate > rangeTo) break;
                AddItem(projectedDate, new PlanSetItemDto(r.SetId, r.Title, r.TotalWords, false, 0, IsProjected: true, ReviewStage: nextStage));
            }
        }

        return Enumerable.Range(0, days)
            .Select(i =>
            {
                var date = from.AddDays(i);
                var sets = grouped.GetValueOrDefault(date, [])
                    .OrderBy(s => s.IsProjected)   // confirmed first, projected last
                    .ToList();
                return new PlanDayDto(date.ToDateTime(TimeOnly.MinValue), sets.Sum(s => s.TotalWords), sets);
            })
            .ToList();
    }
}
