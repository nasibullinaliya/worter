using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VocabApp.API.Data;
using VocabApp.API.DTOs;
using VocabApp.API.Extensions;
using VocabApp.API.Models;

namespace VocabApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/folders")]
public class FoldersController(AppDbContext db) : ControllerBase
{
    // GET /api/folders
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var userId = User.GetUserId();
        var folders = await db.Folders
            .Where(f => f.UserId == userId)
            .OrderBy(f => f.Name)
            .Select(f => new FolderDto(
                f.Id,
                f.Name,
                f.Sets.Count(s => s.OwnerId == userId)
            ))
            .ToListAsync();
        return Ok(folders);
    }

    // POST /api/folders
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateFolderRequest req)
    {
        var userId = User.GetUserId();
        var folder = new Folder
        {
            Id = Guid.NewGuid(),
            Name = req.Name.Trim(),
            UserId = userId,
            CreatedAt = DateTime.UtcNow
        };
        db.Folders.Add(folder);
        await db.SaveChangesAsync();
        return Ok(new FolderDto(folder.Id, folder.Name, 0));
    }

    // PUT /api/folders/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateFolderRequest req)
    {
        var userId = User.GetUserId();
        var folder = await db.Folders.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
        if (folder == null) return NotFound();
        folder.Name = req.Name.Trim();
        await db.SaveChangesAsync();
        return Ok(new FolderDto(folder.Id, folder.Name,
            await db.WordSets.CountAsync(s => s.FolderId == folder.Id && s.OwnerId == userId)));
    }

    // DELETE /api/folders/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = User.GetUserId();
        var folder = await db.Folders.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
        if (folder == null) return NotFound();
        db.Folders.Remove(folder);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // PATCH /api/folders/{id}/sets/{setId}  — assign a set to this folder
    [HttpPatch("{id:guid}/sets/{setId:guid}")]
    public async Task<IActionResult> AssignSet(Guid id, Guid setId)
    {
        var userId = User.GetUserId();
        var folder = await db.Folders.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
        if (folder == null) return NotFound();

        // Owned set — store on WordSet
        var ownedSet = await db.WordSets.FirstOrDefaultAsync(s => s.Id == setId && s.OwnerId == userId);
        if (ownedSet != null)
        {
            ownedSet.FolderId = id;
            await db.SaveChangesAsync();
            return NoContent();
        }

        // Saved set — store on UserSet
        var userSet = await db.UserSets.FirstOrDefaultAsync(us => us.UserId == userId && us.SetId == setId);
        if (userSet != null)
        {
            userSet.FolderId = id;
            await db.SaveChangesAsync();
            return NoContent();
        }

        return NotFound();
    }

    // DELETE /api/folders/sets/{setId}  — remove set from any folder
    [HttpDelete("sets/{setId:guid}")]
    public async Task<IActionResult> UnassignSet(Guid setId)
    {
        var userId = User.GetUserId();

        var ownedSet = await db.WordSets.FirstOrDefaultAsync(s => s.Id == setId && s.OwnerId == userId);
        if (ownedSet != null)
        {
            ownedSet.FolderId = null;
            await db.SaveChangesAsync();
            return NoContent();
        }

        var userSet = await db.UserSets.FirstOrDefaultAsync(us => us.UserId == userId && us.SetId == setId);
        if (userSet != null)
        {
            userSet.FolderId = null;
            await db.SaveChangesAsync();
            return NoContent();
        }

        return NotFound();
    }
}
