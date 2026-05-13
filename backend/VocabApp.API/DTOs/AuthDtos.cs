using System.ComponentModel.DataAnnotations;

namespace VocabApp.API.DTOs;

public record GoogleAuthRequest(
    [Required] string IdToken
);

public record AuthResponse(
    string Token,
    UserDto User
);

public record UserDto(
    Guid Id,
    string Email,
    string? Name,
    string? AvatarUrl,
    DateTime CreatedAt
);
