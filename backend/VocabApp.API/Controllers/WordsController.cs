using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VocabApp.API.Data;
using VocabApp.API.DTOs;
using VocabApp.API.Extensions;
using VocabApp.API.Models;

namespace VocabApp.API.Controllers;

[ApiController]
[Authorize]
public class WordsController(AppDbContext db) : ControllerBase
{
    // POST /api/sets/{setId}/words — одно или массив слов
    [HttpPost("api/sets/{setId:guid}/words")]
    public async Task<IActionResult> AddWords(Guid setId, CreateWordsRequest req)
    {
        var userId = User.GetUserId();

        var set = await db.WordSets.FindAsync(setId);
        if (set == null) return NotFound();
        if (set.OwnerId != userId) return Forbid();

        var maxPos = await db.Words
            .Where(w => w.SetId == setId)
            .Select(w => (int?)w.Position)
            .MaxAsync() ?? -1;

        var words = req.Words.Select((w, i) => new Word
        {
            Id = Guid.NewGuid(),
            Term = w.Term.Trim(),
            Definition = w.Definition.Trim(),
            Position = maxPos + 1 + i,
            SetId = setId,
        }).ToList();

        db.Words.AddRange(words);
        set.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(words.Select(w => new WordDto(w.Id, w.Term, w.Definition, w.Position)));
    }

    // PUT /api/words/{id}
    [HttpPut("api/words/{id:guid}")]
    public async Task<IActionResult> UpdateWord(Guid id, UpdateWordRequest req)
    {
        var userId = User.GetUserId();

        var word = await db.Words.Include(w => w.Set).FirstOrDefaultAsync(w => w.Id == id);
        if (word == null) return NotFound();
        if (word.Set.OwnerId != userId) return Forbid();

        word.Term = req.Term.Trim();
        word.Definition = req.Definition.Trim();
        word.Set.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Ok(new WordDto(word.Id, word.Term, word.Definition, word.Position));
    }

    // DELETE /api/words/{id}
    [HttpDelete("api/words/{id:guid}")]
    public async Task<IActionResult> DeleteWord(Guid id)
    {
        var userId = User.GetUserId();

        var word = await db.Words.Include(w => w.Set).FirstOrDefaultAsync(w => w.Id == id);
        if (word == null) return NotFound();
        if (word.Set.OwnerId != userId) return Forbid();

        db.Words.Remove(word);
        word.Set.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }
}
