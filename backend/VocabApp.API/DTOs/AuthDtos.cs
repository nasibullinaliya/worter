using System.ComponentModel.DataAnnotations;

namespace VocabApp.API.DTOs;

public record RegisterRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(6)] string Password,
    string? Name
);

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password
);

public record AuthResponse(
    string Token,
    UserDto User
);

public record UserDto(
    Guid Id,
    string Email,
    string? Name,
    DateTime CreatedAt
);
