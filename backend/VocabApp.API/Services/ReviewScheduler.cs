using VocabApp.API.Models;

namespace VocabApp.API.Services;

public static class ReviewScheduler
{
    // Absolute days from FirstStudiedAt when the next review is due:
    // Stage 1 done → next at day +1
    // Stage 2 done → next at day +2
    // Stage 3 done → next at day +4
    // Stage 4 done → next at day +7
    // Stage 5 done → next at day +14
    // Stage 6 = complete (NextReviewAt = null)
    private static readonly int[] Intervals = [1, 2, 4, 7, 14];

    // If a review is overdue by more than this many days → reset the cycle.
    public const int GracePeriodDays = 3;

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
            NextReviewAt = now.Date.AddDays(Intervals[0]),  // due on next calendar day
            ReviewStage = 1,   // first study = stage 1
            KnownCount = knownCount,
            TotalWords = totalWords,
        };
    }

    public static void RecordReview(SetProgress progress, int knownCount, int totalWords)
    {
        var now = DateTime.UtcNow;
        progress.LastStudiedAt = now;
        progress.KnownCount = knownCount;
        progress.TotalWords = totalWords;

        // Advance stage only when the scheduled review calendar day has arrived.
        // Multiple sessions on the same day do NOT advance the stage.
        if (progress.NextReviewAt.HasValue && progress.NextReviewAt.Value.Date <= now.Date)
        {
            progress.ReviewStage = Math.Min(progress.ReviewStage + 1, Intervals.Length + 1);

            // Stage 6 = complete
            progress.NextReviewAt = progress.ReviewStage <= Intervals.Length
                ? progress.FirstStudiedAt.Date.AddDays(Intervals[progress.ReviewStage - 1])
                : null;
        }
    }

    /// Returns true when the review deadline has been missed by more than GracePeriodDays.
    public static bool IsExpired(SetProgress p) =>
        p.NextReviewAt.HasValue &&
        DateTime.UtcNow.Date > p.NextReviewAt.Value.Date.AddDays(GracePeriodDays);

    /// Resets the SRS cycle — user must start fresh from day 1.
    public static void Reset(SetProgress p)
    {
        p.ReviewStage = 0;
        p.NextReviewAt = null;
        p.KnownCount = 0;
    }

    /// Restarts the SRS cycle after a reset (stage=0, NextReviewAt=null).
    public static void Restart(SetProgress p, int knownCount, int totalWords)
    {
        var now = DateTime.UtcNow;
        p.FirstStudiedAt = now;
        p.LastStudiedAt = now;
        p.ReviewStage = 1;
        p.NextReviewAt = now.Date.AddDays(Intervals[0]);
        p.KnownCount = knownCount;
        p.TotalWords = totalWords;
    }
}
