using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VocabApp.API.Data;
using VocabApp.API.DTOs;
using VocabApp.API.Extensions;
using VocabApp.API.Models;
using VocabApp.API.Services;

namespace VocabApp.API.Controllers;

[ApiController]
[Route("api/progress")]
[Authorize]
public class ProgressController(AppDbContext db) : ControllerBase
{
    // POST /api/progress/{setId}
    [HttpPost("{setId:guid}")]
    public async Task<IActionResult> RecordSession(Guid setId, RecordSessionRequest req)
    {
        var userId = User.GetUserId();

        var set = await db.WordSets.Include(s => s.Words).FirstOrDefaultAsync(s => s.Id == setId);
        if (set == null) return NotFound();

        var isOwner = set.OwnerId == userId;
        var isSaved = await db.UserSets.AnyAsync(us => us.UserId == userId && us.SetId == setId);
        if (!isOwner && !isSaved) return Forbid();

        var wordIds = set.Words.Select(w => w.Id).ToHashSet();
        var knownIds = req.KnownWordIds.Where(id => wordIds.Contains(id)).ToHashSet();

        // Upsert WordProgress for all words in the set
        var existing = await db.WordProgress
            .Where(p => p.UserId == userId && wordIds.Contains(p.WordId))
            .ToDictionaryAsync(p => p.WordId);

        var now = DateTime.UtcNow;
        foreach (var word in set.Words)
        {
            var isKnown = knownIds.Contains(word.Id);
            if (existing.TryGetValue(word.Id, out var wp))
            {
                if (isKnown) wp.KnownCount++;
                else wp.UnknownCount++;
                wp.LastSeenAt = now;
            }
            else
            {
                db.WordProgress.Add(new WordProgress
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    WordId = word.Id,
                    KnownCount = isKnown ? 1 : 0,
                    UnknownCount = isKnown ? 0 : 1,
                    LastSeenAt = now,
                });
            }
        }

        // Upsert SetProgress
        var setProgress = await db.SetProgress.FirstOrDefaultAsync(p => p.UserId == userId && p.SetId == setId);
        if (setProgress == null)
        {
            setProgress = ReviewScheduler.StartTracking(userId, setId, knownIds.Count, wordIds.Count);
            db.SetProgress.Add(setProgress);
        }
        else if (setProgress.ReviewStage == 0 && !setProgress.NextReviewAt.HasValue)
        {
            // Record was reset due to grace period expiry — restart the SRS cycle
            ReviewScheduler.Restart(setProgress, knownIds.Count, wordIds.Count);
        }
        else
        {
            ReviewScheduler.RecordReview(setProgress, knownIds.Count, wordIds.Count);
        }

        await db.SaveChangesAsync();

        return Ok(ToDto(setProgress));
    }

    // GET /api/progress/{setId}
    [HttpGet("{setId:guid}")]
    public async Task<IActionResult> GetProgress(Guid setId)
    {
        var userId = User.GetUserId();

        var set = await db.WordSets.Include(s => s.Words).FirstOrDefaultAsync(s => s.Id == setId);
        if (set == null) return NotFound();

        var isOwner = set.OwnerId == userId;
        var isSaved = await db.UserSets.AnyAsync(us => us.UserId == userId && us.SetId == setId);
        if (!isOwner && !isSaved && !set.IsPublic) return Forbid();

        var setProgress = await db.SetProgress.FirstOrDefaultAsync(p => p.UserId == userId && p.SetId == setId);

        var wordIds = set.Words.Select(w => w.Id).ToList();
        var wordProgress = await db.WordProgress
            .Where(p => p.UserId == userId && wordIds.Contains(p.WordId))
            .ToDictionaryAsync(p => p.WordId);

        var wordItems = set.Words
            .OrderBy(w => w.Position)
            .Select(w =>
            {
                wordProgress.TryGetValue(w.Id, out var wp);
                return new WordProgressDto(
                    w.Id, w.Term, w.Definition,
                    wp?.KnownCount ?? 0,
                    wp?.UnknownCount ?? 0,
                    wp?.LastSeenAt ?? DateTime.MinValue);
            })
            .ToList();

        return Ok(new ProgressDetailDto(setProgress != null ? ToDto(setProgress) : null, wordItems));
    }

    private static SetProgressDto ToDto(SetProgress p) =>
        new(p.SetId, p.FirstStudiedAt, p.LastStudiedAt, p.NextReviewAt, p.ReviewStage, p.KnownCount, p.TotalWords);
}
