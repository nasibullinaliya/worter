using System.ComponentModel.DataAnnotations;

namespace VocabApp.API.DTOs;

public record CreateSetRequest(
    [Required, MaxLength(200)] string Title,
    [MaxLength(2000)] string? Description,
    bool IsPublic,
    [MaxLength(10)] string? Language
);

public record UpdateSetRequest(
    [Required, MaxLength(200)] string Title,
    [MaxLength(2000)] string? Description,
    bool IsPublic,
    [MaxLength(10)] string? Language
);

public record SetProgressSummary(
    int KnownCount,
    int TotalWords,
    DateTime? NextReviewAt,
    int ReviewStage
);

public record SetSummaryDto(
    Guid Id,
    string Title,
    string? Description,
    bool IsPublic,
    bool IsOwner,
    int WordCount,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    SetProgressSummary? Progress,
    string Language = "de-DE"
);

public record SetDetailDto(
    Guid Id,
    string Title,
    string? Description,
    bool IsPublic,
    bool IsOwner,
    bool IsSaved,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<WordDto> Words,
    string Language = "de-DE"
);

public record ExploreItemDto(
    Guid Id,
    string Title,
    string? Description,
    string AuthorName,
    int WordCount,
    DateTime CreatedAt
);

public record ExploreResultDto(
    List<ExploreItemDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);

public record ReminderDto(
    Guid SetId,
    string Title,
    int KnownCount,
    int TotalWords,
    DateTime NextReviewAt,
    int ReviewStage
);
