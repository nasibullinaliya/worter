using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VocabApp.API.Data;
using VocabApp.API.Extensions;
using VocabApp.API.Services;

namespace VocabApp.API.Controllers;

public record GenerateTextRequest(
    string Level = "A2",
    int SentenceCount = 6
);

public record GenerateTextResponse(string Text);

[ApiController]
[Route("api/sets/{setId:guid}/generate-text")]
[Authorize]
public class TextGenController(AppDbContext db, GeminiService gemini) : ControllerBase
{
    private static readonly HashSet<string> ValidLevels = ["A1", "A2", "B1", "B2"];

    [HttpPost]
    public async Task<IActionResult> Generate(
        Guid setId,
        [FromBody] GenerateTextRequest req,
        CancellationToken ct)
    {
        var userId = User.GetUserId();

        var set = await db.WordSets
            .Include(s => s.Words)
            .FirstOrDefaultAsync(s => s.Id == setId, ct);

        if (set == null) return NotFound();

        // Allow owner or user who saved the set
        var isSaved = await db.UserSets.AnyAsync(us => us.SetId == setId && us.UserId == userId, ct);
        if (set.OwnerId != userId && !isSaved) return Forbid();

        if (set.Words.Count == 0)
            return BadRequest(new { message = "Set has no words." });

        var level = ValidLevels.Contains(req.Level.ToUpper()) ? req.Level.ToUpper() : "A2";
        var sentences = Math.Clamp(req.SentenceCount, 3, 15);

        var words = set.Words.Select(w => w.Term).ToList();

        try
        {
            var text = await gemini.GenerateTextAsync(words, set.Language ?? "de-DE", level, sentences, ct);
            return Ok(new GenerateTextResponse(text));
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(503, new { message = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(502, new { message = $"Gemini API error: {ex.Message}" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
