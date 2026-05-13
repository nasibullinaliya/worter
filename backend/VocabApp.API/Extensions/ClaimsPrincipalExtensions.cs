using System.Security.Claims;

namespace VocabApp.API.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var value = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                 ?? principal.FindFirstValue("sub");
        if (!Guid.TryParse(value, out var id))
            throw new UnauthorizedAccessException("Invalid user identity.");
        return id;
    }
}
