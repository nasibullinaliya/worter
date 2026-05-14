using System.ComponentModel.DataAnnotations;

namespace VocabApp.API.DTOs;

public record RecordSessionRequest([Required] List<Guid> KnownWordIds);

public record RecordWordProgressRequest(
    [Required] List<Guid> KnownWordIds,
    [Required] List<Guid> UnknownWordIds
);

public record SetProgressDto(
    Guid SetId,
    DateTime FirstStudiedAt,
    DateTime LastStudiedAt,
    DateTime? NextReviewAt,
    int ReviewStage,
    int KnownCount,
    int TotalWords
);

public record WordProgressDto(
    Guid WordId,
    string Term,
    string Definition,
    int KnownCount,
    int UnknownCount,
    DateTime LastSeenAt
);

public record ProgressDetailDto(
    SetProgressDto? SetProgress,
    List<WordProgressDto> WordItems
);

public record AllWordsItemDto(
    Guid WordId,
    string Term,
    string Definition,
    Guid SetId,
    string SetTitle
);

public record WeeklyDayDto(DateTime Date, int WordCount);
