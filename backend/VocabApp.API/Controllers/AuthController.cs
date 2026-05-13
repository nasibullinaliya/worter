using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VocabApp.API.DTOs;
using VocabApp.API.Extensions;
using VocabApp.API.Services;

namespace VocabApp.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AuthService authService) : ControllerBase
{
    [HttpPost("google")]
    public async Task<IActionResult> Google([FromBody] GoogleAuthRequest req)
    {
        try
        {
            var result = await authService.GoogleLoginAsync(req.IdToken);
            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(new { message = "Invalid Google token." });
        }
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = User.GetUserId();
        try
        {
            var user = await authService.GetByIdAsync(userId);
            return Ok(user);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
