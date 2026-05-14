using System.ComponentModel.DataAnnotations;

namespace VocabApp.API.DTOs;

public record CreateSetRequest(
    [Required, MaxLength(200)] string Title,
    [MaxLength(2000)] string? Description,
    bool IsPublic
);

public record UpdateSetRequest(
    [Required, MaxLength(200)] string Title,
    [MaxLength(2000)] string? Description,
    bool IsPublic
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
    SetProgressSummary? Progress
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
    List<WordDto> Words
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
