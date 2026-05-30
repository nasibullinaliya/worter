using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VocabApp.API.Data;
using VocabApp.API.DTOs;
using VocabApp.API.Extensions;

namespace VocabApp.API.Controllers;

[ApiController]
[Route("api/dictionary")]
[Authorize]
public class DictionaryController(AppDbContext db) : ControllerBase
{
    // GET /api/dictionary?search=&page=1&pageSize=20
    [HttpGet]
    public async Task<IActionResult> GetDictionary(
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var userId = User.GetUserId();

        // All words from owned sets + saved sets
        var wordQuery = db.Words
            .Where(w => w.Set.OwnerId == userId ||
                        db.UserSets.Any(us => us.UserId == userId && us.SetId == w.SetId));

        // Search filter (term or definition, case-insensitive)
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            wordQuery = wordQuery.Where(w =>
                w.Term.ToLower().Contains(s) ||
                w.Definition.ToLower().Contains(s));
        }

        var totalCount = await wordQuery.CountAsync();

        var wordPage = await wordQuery
            .OrderBy(w => w.Term.ToLower())
            .ThenBy(w => w.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(w => new { w.Id, w.Term, w.Definition, w.Example, w.SetId, SetTitle = w.Set.Title })
            .ToListAsync();

        // Load IsFinalCompleted for this page
        var wordIds = wordPage.Select(w => w.Id).ToHashSet();
        var finalCompletedIds = (await db.WordProgress
            .Where(p => p.UserId == userId && wordIds.Contains(p.WordId) && p.IsFinalCompleted)
            .Select(p => p.WordId)
            .ToListAsync())
            .ToHashSet();

        var items = wordPage.Select(w => new DictionaryWordDto(
            w.Id, w.Term, w.Definition, w.Example, w.SetId, w.SetTitle,
            finalCompletedIds.Contains(w.Id)
        )).ToList();

        return Ok(new DictionaryPageDto(items, totalCount, page, pageSize));
    }
}
