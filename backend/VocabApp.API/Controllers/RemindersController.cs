using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VocabApp.API.Data;
using VocabApp.API.DTOs;
using VocabApp.API.Extensions;
using VocabApp.API.Services;

namespace VocabApp.API.Controllers;

[ApiController]
[Route("api/reminders")]
[Authorize]
public class RemindersController(AppDbContext db) : ControllerBase
{
    // GET /api/reminders
    // 1. Resets any progress records overdue by more than GracePeriodDays.
    // 2. Returns sets whose review is due (overdue within the grace window).
    [HttpGet]
    public async Task<IActionResult> GetDue()
    {
        var userId = User.GetUserId();
        var now = DateTime.UtcNow;

        // ── Reset expired records ──────────────────────────────────────────────
        var today = now.Date;
        var expired = await db.SetProgress
            .Where(p => p.UserId == userId
                     && p.NextReviewAt != null
                     && p.NextReviewAt.Value.Date.AddDays(ReviewScheduler.GracePeriodDays) < today)
            .ToListAsync();

        if (expired.Count > 0)
        {
            foreach (var p in expired)
                ReviewScheduler.Reset(p);

            await db.SaveChangesAsync();
        }

        // ── Return reminders within the grace window ──────────────────────────
        var due = await db.SetProgress
            .Where(p => p.UserId == userId
                     && p.NextReviewAt != null
                     && p.NextReviewAt.Value.Date <= today)
            .Include(p => p.Set)
            .OrderBy(p => p.NextReviewAt)
            .Select(p => new ReminderDto(
                p.SetId,
                p.Set.Title,
                p.KnownCount,
                p.TotalWords,
                p.NextReviewAt!.Value,
                p.ReviewStage))
            .ToListAsync();

        return Ok(due);
    }
}
