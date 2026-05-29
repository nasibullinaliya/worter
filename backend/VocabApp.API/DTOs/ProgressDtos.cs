using System.ComponentModel.DataAnnotations;

namespace VocabApp.API.DTOs;

/// <summary>Result for a single word in a study session.</summary>
/// <param name="WordId">The word's ID.</param>
/// <param name="ErrorCount">Number of mistakes made on this word (0 = perfect).</param>
public record WordSessionResult(Guid WordId, int ErrorCount);

public record RecordSessionRequest([Required] List<WordSessionResult> WordResults, bool IsFinalStage = false);

public record RecordWordProgressRequest([Required] List<WordSessionResult> WordResults);

public record SetProgressDto(
    Guid SetId,
    DateTime FirstStudiedAt,
    DateTime LastStudiedAt,
    DateTime? NextReviewAt,
    int ReviewStage,
    int KnownCount,
    int TotalWords,
    bool IsFinalStageFailed = false  // true when stage-5 test was attempted but not passed perfectly
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

public record SetStudyLogDto(
    DateTime StudiedAt,
    int StageBefore,
    int StageAfter,
    DateTime? NextReviewAtAfter,
    int KnownCount,
    int TotalWords);
