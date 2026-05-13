using VocabApp.API.Models;

namespace VocabApp.API.Services;

public static class ReviewScheduler
{
    private static readonly int[] Intervals = [1, 2, 4, 7, 14];

    public static SetProgress StartTracking(Guid userId, Guid setId, int knownCount, int totalWords)
    {
        var now = DateTime.UtcNow;
        return new SetProgress
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            SetId = setId,
            FirstStudiedAt = now,
            LastStudiedAt = now,
            NextReviewAt = now.AddDays(Intervals[0]),
            ReviewStage = 0,
            KnownCount = knownCount,
            TotalWords = totalWords,
        };
    }

    public static void RecordReview(SetProgress progress, int knownCount, int totalWords)
    {
        progress.LastStudiedAt = DateTime.UtcNow;
        progress.KnownCount = knownCount;
        progress.TotalWords = totalWords;
        progress.ReviewStage = Math.Min(progress.ReviewStage + 1, Intervals.Length);

        progress.NextReviewAt = progress.ReviewStage < Intervals.Length
            ? progress.FirstStudiedAt.AddDays(Intervals[progress.ReviewStage])
            : null;
    }
}
