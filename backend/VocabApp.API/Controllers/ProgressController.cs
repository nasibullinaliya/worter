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
        // wordId → errorCount, only for words actually tested
        var resultMap = req.WordResults
            .Where(r => wordIds.Contains(r.WordId))
            .ToDictionary(r => r.WordId, r => r.ErrorCount);

        var knownCount = resultMap.Count(r => r.Value == 0);

        // Upsert WordProgress only for words that were tested
        var existing = await db.WordProgress
            .Where(p => p.UserId == userId && resultMap.Keys.Contains(p.WordId))
            .ToDictionaryAsync(p => p.WordId);

        var now = DateTime.UtcNow;
        foreach (var (wordId, errorCount) in resultMap)
        {
            var isKnown = errorCount == 0;
            if (existing.TryGetValue(wordId, out var wp))
            {
                if (isKnown) wp.KnownCount++;
                else wp.UnknownCount += errorCount;
                wp.LastSeenAt = now;
            }
            else
            {
                db.WordProgress.Add(new WordProgress
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    WordId = wordId,
                    KnownCount = isKnown ? 1 : 0,
                    UnknownCount = isKnown ? 0 : errorCount,
                    LastSeenAt = now,
                });
            }
        }

        // Upsert SetProgress
        var setProgress = await db.SetProgress.FirstOrDefaultAsync(p => p.UserId == userId && p.SetId == setId);
        if (setProgress == null)
        {
            setProgress = ReviewScheduler.StartTracking(userId, setId, knownCount, wordIds.Count);
            db.SetProgress.Add(setProgress);
        }
        else if (ReviewScheduler.IsExpired(setProgress) ||
                 (setProgress.ReviewStage == 0 && !setProgress.NextReviewAt.HasValue))
        {
            // Grace period exceeded → restart the SRS cycle from scratch
            ReviewScheduler.Restart(setProgress, knownCount, wordIds.Count);
        }
        else
        {
            ReviewScheduler.RecordReview(setProgress, knownCount, wordIds.Count);
        }

        // Record daily progress
        await UpsertDailyProgress(userId, resultMap.Count);

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

    // POST /api/progress/words — record word-level progress without SRS (multi-set sessions, quiz)
    [HttpPost("words")]
    public async Task<IActionResult> RecordWordProgress(RecordWordProgressRequest req)
    {
        var userId = User.GetUserId();
        if (req.WordResults.Count == 0) return Ok();

        var allWordIds = req.WordResults.Select(r => r.WordId).ToHashSet();

        // Only accept words from sets the user owns or has saved
        var accessibleWordIdsList = await db.Words
            .Where(w => allWordIds.Contains(w.Id) &&
                   (w.Set.OwnerId == userId ||
                    db.UserSets.Any(us => us.UserId == userId && us.SetId == w.SetId)))
            .Select(w => w.Id)
            .ToListAsync();
        var accessibleWordIds = accessibleWordIdsList.ToHashSet();

        var resultMap = req.WordResults
            .Where(r => accessibleWordIds.Contains(r.WordId))
            .ToDictionary(r => r.WordId, r => r.ErrorCount);

        var existing = await db.WordProgress
            .Where(p => p.UserId == userId && resultMap.Keys.Contains(p.WordId))
            .ToDictionaryAsync(p => p.WordId);

        var now = DateTime.UtcNow;
        foreach (var (wordId, errorCount) in resultMap)
        {
            var isKnown = errorCount == 0;
            if (existing.TryGetValue(wordId, out var wp))
            {
                if (isKnown) wp.KnownCount++;
                else wp.UnknownCount += errorCount;
                wp.LastSeenAt = now;
            }
            else
            {
                db.WordProgress.Add(new WordProgress
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    WordId = wordId,
                    KnownCount = isKnown ? 1 : 0,
                    UnknownCount = isKnown ? 0 : errorCount,
                    LastSeenAt = now,
                });
            }
        }

        // Record daily progress
        await UpsertDailyProgress(userId, resultMap.Count);

        await db.SaveChangesAsync();
        return Ok();
    }

    // GET /api/progress/weakest-words?setIds=id1,id2&count=20
    // Returns N words with the lowest known-rate from the given sets
    [HttpGet("weakest-words")]
    public async Task<IActionResult> GetWeakestWords([FromQuery] string setIds, [FromQuery] int count = 20)
    {
        if (string.IsNullOrWhiteSpace(setIds)) return BadRequest("setIds is required");
        if (count <= 0 || count > 500) return BadRequest("count must be 1–500");

        Guid[] parsedIds;
        try { parsedIds = setIds.Split(',').Select(Guid.Parse).ToArray(); }
        catch { return BadRequest("Invalid setIds format"); }

        var userId = User.GetUserId();
        var parsedSet = parsedIds.ToHashSet();

        var words = await db.Words
            .Where(w => parsedSet.Contains(w.SetId) &&
                   (w.Set.OwnerId == userId ||
                    db.UserSets.Any(us => us.UserId == userId && us.SetId == w.SetId)))
            .Select(w => new { w.Id, w.Term, w.Definition, w.SetId, SetTitle = w.Set.Title })
            .ToListAsync();

        if (words.Count == 0) return Ok(Array.Empty<AllWordsItemDto>());

        var wordIds = words.Select(w => w.Id).ToHashSet();
        var progressMap = await db.WordProgress
            .Where(p => p.UserId == userId && wordIds.Contains(p.WordId))
            .ToDictionaryAsync(p => p.WordId);

        // Sort priority:
        //   1. Seen + weak  (rate < 1.0)  — lowest rate first, then highest unknownCount
        //   2. Seen + mastered (rate = 1.0) — studied before but no errors yet
        //   3. Never seen                  — completely new words, lowest priority
        var ranked = words
            .OrderBy(w =>
            {
                if (!progressMap.TryGetValue(w.Id, out var p)) return 2; // never seen → last
                var total = p.KnownCount + p.UnknownCount;
                if (total == 0) return 2;
                return (double)p.KnownCount / total < 1.0 ? 0 : 1;      // 0=weak, 1=mastered
            })
            .ThenBy(w =>
            {
                if (!progressMap.TryGetValue(w.Id, out var p)) return 1.0;
                var total = p.KnownCount + p.UnknownCount;
                return total == 0 ? 1.0 : (double)p.KnownCount / total;
            })
            .ThenByDescending(w =>
                progressMap.TryGetValue(w.Id, out var p) ? p.UnknownCount : 0)
            .Take(count)
            .Select(w => new AllWordsItemDto(w.Id, w.Term, w.Definition, w.SetId, w.SetTitle))
            .ToList();

        return Ok(ranked);
    }

    // GET /api/progress/weekly — слов пройдено за каждый день текущей недели (Пн–Вс)
    [HttpGet("weekly")]
    public async Task<IActionResult> GetWeeklyProgress()
    {
        var userId = User.GetUserId();
        var todayUtc = DateOnly.FromDateTime(DateTime.UtcNow);

        var dow = (int)todayUtc.DayOfWeek;
        var daysFromMonday = dow == 0 ? 6 : dow - 1;
        var monday = todayUtc.AddDays(-daysFromMonday);

        var rows = await db.DailyProgress
            .Where(p => p.UserId == userId && p.Date >= monday)
            .ToListAsync();

        var grouped = rows.ToDictionary(p => p.Date, p => p.WordCount);

        var result = Enumerable.Range(0, 7).Select(i =>
        {
            var date = monday.AddDays(i);
            return new WeeklyDayDto(date.ToDateTime(TimeOnly.MinValue), grouped.GetValueOrDefault(date, 0));
        }).ToList();

        return Ok(result);
    }

    // GET /api/progress/monthly — последние 30 дней включая сегодня
    [HttpGet("monthly")]
    public async Task<IActionResult> GetMonthlyProgress()
    {
        var userId = User.GetUserId();
        var todayUtc = DateOnly.FromDateTime(DateTime.UtcNow);
        var startDate = todayUtc.AddDays(-29);

        var rows = await db.DailyProgress
            .Where(p => p.UserId == userId && p.Date >= startDate)
            .ToListAsync();

        var grouped = rows.ToDictionary(p => p.Date, p => p.WordCount);

        var result = Enumerable.Range(0, 30).Select(i =>
        {
            var date = startDate.AddDays(i);
            return new WeeklyDayDto(date.ToDateTime(TimeOnly.MinValue), grouped.GetValueOrDefault(date, 0));
        }).ToList();

        return Ok(result);
    }

    private async Task UpsertDailyProgress(Guid userId, int wordCount)
    {
        if (wordCount <= 0) return;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var row = await db.DailyProgress.FindAsync(userId, today);
        if (row == null)
            db.DailyProgress.Add(new Models.DailyProgress { UserId = userId, Date = today, WordCount = wordCount });
        else
            row.WordCount += wordCount;
    }

    private static SetProgressDto ToDto(SetProgress p) =>
        new(p.SetId, p.FirstStudiedAt, p.LastStudiedAt, p.NextReviewAt, p.ReviewStage, p.KnownCount, p.TotalWords);
}
