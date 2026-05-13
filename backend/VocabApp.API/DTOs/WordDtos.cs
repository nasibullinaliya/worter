using System.ComponentModel.DataAnnotations;

namespace VocabApp.API.DTOs;

public record WordDto(
    Guid Id,
    string Term,
    string Definition,
    int Position
);

public record CreateWordRequest(
    [Required, MaxLength(500)] string Term,
    [Required, MaxLength(2000)] string Definition
);

public record CreateWordsRequest(
    [Required, MinLength(1), MaxLength(500)] List<CreateWordRequest> Words
);

public record UpdateWordRequest(
    [Required, MaxLength(500)] string Term,
    [Required, MaxLength(2000)] string Definition
);
