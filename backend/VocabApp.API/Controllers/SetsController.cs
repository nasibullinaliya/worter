using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VocabApp.API.Data;
using VocabApp.API.DTOs;
using VocabApp.API.Extensions;
using VocabApp.API.Models;

namespace VocabApp.API.Controllers;

[ApiController]
[Route("api/sets")]
[Authorize]
public class SetsController(AppDbContext db) : ControllerBase
{
    private static readonly HashSet<string> ValidLangs =
        ["de-DE", "en-US", "en-GB", "ru-RU", "fr-FR", "es-ES", "it-IT"];
    // GET /api/sets — owned + saved sets, with progress summary
    [HttpGet]
    public async Task<IActionResult> GetMySets()
    {
        var userId = User.GetUserId();

        // Load progress map once
        var progressMap = await db.SetProgress
            .Where(p => p.UserId == userId)
            .ToDictionaryAsync(p => p.SetId);

        SetProgressSummary? GetProgress(Guid setId) =>
            progressMap.TryGetValue(setId, out var p)
                ? new SetProgressSummary(p.KnownCount, p.TotalWords, p.NextReviewAt, p.ReviewStage)
                : null;

        var owned = await db.WordSets
            .Where(s => s.OwnerId == userId)
            .Select(s => new { s.Id, s.Title, s.Description, s.IsPublic, s.Language, s.CreatedAt, s.UpdatedAt, WordCount = s.Words.Count })
            .ToListAsync();

        var saved = await db.UserSets
            .Where(us => us.UserId == userId)
            .Select(us => new { us.Set.Id, us.Set.Title, us.Set.Description, us.Set.IsPublic, us.Set.Language, us.Set.CreatedAt, us.Set.UpdatedAt, WordCount = us.Set.Words.Count })
            .ToListAsync();

        var result = owned.Select(s => new SetSummaryDto(s.Id, s.Title, s.Description, s.IsPublic, true, s.WordCount, s.CreatedAt, s.UpdatedAt, GetProgress(s.Id), s.Language))
            .Concat(saved.Select(s => new SetSummaryDto(s.Id, s.Title, s.Description, s.IsPublic, false, s.WordCount, s.CreatedAt, s.UpdatedAt, GetProgress(s.Id), s.Language)))
            .OrderByDescending(s => s.CreatedAt);

        return Ok(result);
    }

    // POST /api/sets
    [HttpPost]
    public async Task<IActionResult> Create(CreateSetRequest req)
    {
        var userId = User.GetUserId();
        var now = DateTime.UtcNow;

        var lang = ValidLangs.Contains(req.Language ?? "") ? req.Language! : "de-DE";
        var set = new WordSet
        {
            Id = Guid.NewGuid(),
            Title = req.Title.Trim(),
            Description = req.Description?.Trim(),
            IsPublic = req.IsPublic,
            Language = lang,
            OwnerId = userId,
            CreatedAt = now,
            UpdatedAt = now,
        };

        db.WordSets.Add(set);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = set.Id },
            new SetSummaryDto(set.Id, set.Title, set.Description, set.IsPublic, true, 0, set.CreatedAt, set.UpdatedAt, null, set.Language));
    }

    // GET /api/sets/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var userId = User.GetUserId();

        var set = await db.WordSets
            .Include(s => s.Words.OrderBy(w => w.Position))
            .FirstOrDefaultAsync(s => s.Id == id);

        if (set == null) return NotFound();

        var isOwner = set.OwnerId == userId;
        var isSaved = await db.UserSets.AnyAsync(us => us.UserId == userId && us.SetId == id);

        if (!isOwner && !isSaved && !set.IsPublic)
            return Forbid();

        var words = set.Words.Select(w => new WordDto(w.Id, w.Term, w.Definition, w.Position)).ToList();

        return Ok(new SetDetailDto(
            set.Id, set.Title, set.Description, set.IsPublic, isOwner, isSaved,
            set.CreatedAt, set.UpdatedAt, words, set.Language));
    }

    // PUT /api/sets/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateSetRequest req)
    {
        var userId = User.GetUserId();
        var set = await db.WordSets.FindAsync(id);

        if (set == null) return NotFound();
        if (set.OwnerId != userId) return Forbid();

        set.Title = req.Title.Trim();
        set.Description = req.Description?.Trim();
        set.IsPublic = req.IsPublic;
        set.Language = ValidLangs.Contains(req.Language ?? "") ? req.Language! : set.Language;
        set.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/sets/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = User.GetUserId();
        var set = await db.WordSets.FindAsync(id);

        if (set == null) return NotFound();
        if (set.OwnerId != userId) return Forbid();

        db.WordSets.Remove(set);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // GET /api/sets/all-words — все слова из всех наборов пользователя (для теста по всем наборам)
    [HttpGet("all-words")]
    public async Task<IActionResult> GetAllWords()
    {
        var userId = User.GetUserId();

        var ownedWords = await db.WordSets
            .Where(s => s.OwnerId == userId)
            .SelectMany(s => s.Words.Select(w => new AllWordsItemDto(w.Id, w.Term, w.Definition, s.Id, s.Title)))
            .ToListAsync();

        var savedWords = await db.UserSets
            .Where(us => us.UserId == userId)
            .SelectMany(us => us.Set.Words.Select(w => new AllWordsItemDto(w.Id, w.Term, w.Definition, us.Set.Id, us.Set.Title)))
            .ToListAsync();

        return Ok(ownedWords.Concat(savedWords));
    }

    // POST /api/sets/{id}/clone — добавить чужой набор к себе
    [HttpPost("{id:guid}/clone")]
    public async Task<IActionResult> Clone(Guid id)
    {
        var userId = User.GetUserId();

        var set = await db.WordSets.FindAsync(id);
        if (set == null) return NotFound();
        if (!set.IsPublic && set.OwnerId != userId) return Forbid();
        if (set.OwnerId == userId) return Conflict(new { message = "Это ваш собственный набор." });

        var alreadySaved = await db.UserSets.AnyAsync(us => us.UserId == userId && us.SetId == id);
        if (alreadySaved) return Conflict(new { message = "Набор уже добавлен." });

        db.UserSets.Add(new UserSet { UserId = userId, SetId = id, AddedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        return Ok();
    }
}
