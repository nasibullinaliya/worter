using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VocabApp.API.Data;
using VocabApp.API.DTOs;
using VocabApp.API.Extensions;

namespace VocabApp.API.Controllers;

[ApiController]
[Route("api/reminders")]
[Authorize]
public class RemindersController(AppDbContext db) : ControllerBase
{
    // GET /api/reminders — наборы где next_review_at <= now
    [HttpGet]
    public async Task<IActionResult> GetDue()
    {
        var userId = User.GetUserId();
        var now = DateTime.UtcNow;

        var due = await db.SetProgress
            .Where(p => p.UserId == userId
                     && p.NextReviewAt != null
                     && p.NextReviewAt <= now)
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
