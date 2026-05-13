using System.ComponentModel.DataAnnotations;

namespace VocabApp.API.DTOs;

public record WordDto(
    Guid Id,
    string Term,
    string Definition,
    int Position
);

public record CreateWordRequest(
    [Required] string Term,
    [Required] string Definition
);

public record CreateWordsRequest(
    [Required, MinLength(1)] List<CreateWordRequest> Words
);

public record UpdateWordRequest(
    [Required] string Term,
    [Required] string Definition
);
