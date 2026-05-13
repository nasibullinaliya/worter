using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VocabApp.API.Data;
using VocabApp.API.DTOs;
using VocabApp.API.Extensions;

namespace VocabApp.API.Controllers;

[ApiController]
[Route("api/explore")]
[Authorize]
public class ExploreController(AppDbContext db) : ControllerBase
{
    private const int DefaultPageSize = 20;

    // GET /api/explore?q=&page=1
    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] int page = 1)
    {
        var userId = User.GetUserId();
        if (page < 1) page = 1;

        // Исключаем свои наборы и уже сохранённые
        var savedSetIds = await db.UserSets
            .Where(us => us.UserId == userId)
            .Select(us => us.SetId)
            .ToListAsync();

        var query = db.WordSets
            .Where(s => s.IsPublic && s.OwnerId != userId && !savedSetIds.Contains(s.Id));

        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(s => EF.Functions.ILike(s.Title, $"%{q.Trim()}%"));

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * DefaultPageSize)
            .Take(DefaultPageSize)
            .Select(s => new ExploreItemDto(
                s.Id,
                s.Title,
                s.Description,
                s.Owner.Name ?? s.Owner.Email,
                s.Words.Count,
                s.CreatedAt))
            .ToListAsync();

        return Ok(new ExploreResultDto(items, totalCount, page, DefaultPageSize));
    }
}
