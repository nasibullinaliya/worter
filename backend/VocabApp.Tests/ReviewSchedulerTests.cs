using FluentAssertions;
using VocabApp.API.Models;
using VocabApp.API.Services;

namespace VocabApp.Tests;

public class ReviewSchedulerTests
{
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid SetId = Guid.NewGuid();

    // ── StartTracking ──────────────────────────────────────────────────────────

    [Fact]
    public void StartTracking_Creates_StageOne_Record()
    {
        var result = ReviewScheduler.StartTracking(UserId, SetId, knownCount: 8, totalWords: 10);

        result.UserId.Should().Be(UserId);
        result.SetId.Should().Be(SetId);
        result.ReviewStage.Should().Be(1);
        result.KnownCount.Should().Be(8);
        result.TotalWords.Should().Be(10);
    }

    [Fact]
    public void StartTracking_Sets_NextReviewAt_To_Tomorrow()
    {
        var before = DateTime.UtcNow.Date;
        var result = ReviewScheduler.StartTracking(UserId, SetId, 5, 10);

        result.NextReviewAt.Should().NotBeNull();
        result.NextReviewAt!.Value.Date.Should().Be(before.AddDays(1));
    }

    [Fact]
    public void StartTracking_FirstStudiedAt_And_LastStudiedAt_Are_Close_To_Now()
    {
        var result = ReviewScheduler.StartTracking(UserId, SetId, 5, 10);

        result.FirstStudiedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        result.LastStudiedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    // ── RecordReview ───────────────────────────────────────────────────────────

    [Fact]
    public void RecordReview_Advances_Stage_When_Due()
    {
        var p = MakeProgress(stage: 1, daysAgo: 1); // NextReviewAt = today → due

        ReviewScheduler.RecordReview(p, knownCount: 10, totalWords: 10);

        p.ReviewStage.Should().Be(2);
        p.NextReviewAt.Should().NotBeNull();
    }

    [Fact]
    public void RecordReview_Does_Not_Advance_Stage_On_Same_Day()
    {
        var p = MakeProgress(stage: 1, daysAgo: 0); // NextReviewAt = tomorrow → not due

        ReviewScheduler.RecordReview(p, knownCount: 10, totalWords: 10);

        p.ReviewStage.Should().Be(1); // unchanged
    }

    [Fact]
    public void RecordReview_Advances_Through_All_Stages()
    {
        var p = MakeProgress(stage: 1, daysAgo: 1);

        ReviewScheduler.RecordReview(p, 10, 10);
        p.ReviewStage.Should().Be(2);

        p.NextReviewAt = DateTime.UtcNow.Date.AddDays(-1);
        ReviewScheduler.RecordReview(p, 10, 10);
        p.ReviewStage.Should().Be(3);

        p.NextReviewAt = DateTime.UtcNow.Date.AddDays(-1);
        ReviewScheduler.RecordReview(p, 10, 10);
        p.ReviewStage.Should().Be(4);

        p.NextReviewAt = DateTime.UtcNow.Date.AddDays(-1);
        ReviewScheduler.RecordReview(p, 10, 10);
        p.ReviewStage.Should().Be(5);

        p.NextReviewAt = DateTime.UtcNow.Date.AddDays(-1);
        ReviewScheduler.RecordReview(p, 10, 10);
        p.ReviewStage.Should().Be(6);
        p.NextReviewAt.Should().BeNull("stage 6 is the final stage");
    }

    [Fact]
    public void RecordReview_Stage6_NextReviewAt_Stays_Null()
    {
        var p = MakeProgress(stage: 6, daysAgo: 0);
        p.NextReviewAt = null;

        ReviewScheduler.RecordReview(p, 10, 10);

        p.ReviewStage.Should().Be(6);
        p.NextReviewAt.Should().BeNull();
    }

    [Fact]
    public void RecordReview_Updates_KnownCount_And_TotalWords()
    {
        var p = MakeProgress(stage: 1, daysAgo: 0);

        ReviewScheduler.RecordReview(p, knownCount: 7, totalWords: 12);

        p.KnownCount.Should().Be(7);
        p.TotalWords.Should().Be(12);
    }

    // ── NextReviewAt intervals (relative to study date) ───────────────────────
    //
    // Intervals are relative to when the user ACTUALLY studied (today),
    // not absolute from FirstStudiedAt. This means a missed day simply shifts
    // the schedule forward without skipping stages.
    //
    // Intervals array: [1, 1, 2, 3, 7]
    //   stage 1 done → +1 day
    //   stage 2 done → +1 day
    //   stage 3 done → +2 days
    //   stage 4 done → +3 days
    //   stage 5 done → +7 days

    [Theory]
    [InlineData(1, 1)]   // stage 1→2: today + Intervals[1] = today + 1
    [InlineData(2, 2)]   // stage 2→3: today + Intervals[2] = today + 2
    [InlineData(3, 3)]   // stage 3→4: today + Intervals[3] = today + 3
    [InlineData(4, 7)]   // stage 4→5: today + Intervals[4] = today + 7
    public void RecordReview_Sets_Correct_Relative_Interval(int currentStage, int expectedDaysFromToday)
    {
        var p = MakeProgress(stage: currentStage, daysAgo: 1);
        var today = DateTime.UtcNow.Date;

        ReviewScheduler.RecordReview(p, 10, 10);

        p.NextReviewAt!.Value.Date.Should().Be(today.AddDays(expectedDaysFromToday));
    }

    [Fact]
    public void RecordReview_StudiedToday_NextReviewAt_IsStrictlyInFuture_NotToday()
    {
        // Regression test: user studied a set exactly on its due date (today).
        // After recording the review, the set must NOT re-appear in reminders immediately —
        // NextReviewAt must be strictly after today, never on today itself.
        //
        // Bug that was fixed: with absolute intervals (from FirstStudiedAt), studying late
        // could produce NextReviewAt = today, causing the set to appear in reminders again
        // on the same day. Relative intervals (from actual study date) guarantee at least
        // +1 day for every stage transition.
        var today = DateTime.UtcNow.Date;
        var p = MakeProgress(stage: 1, daysAgo: 1); // NextReviewAt = today → due

        ReviewScheduler.RecordReview(p, knownCount: 10, totalWords: 10);

        p.NextReviewAt.Should().NotBeNull();
        p.NextReviewAt!.Value.Date.Should().BeAfter(today,
            "after studying today the next review must be at least tomorrow, never today");
    }

    [Fact]
    public void RecordReview_NextReviewAt_Is_Always_In_The_Future()
    {
        // For any stage reviewed today, NextReviewAt must be strictly after today
        for (int stage = 1; stage <= 4; stage++)
        {
            var p = MakeProgress(stage: stage, daysAgo: 1);
            ReviewScheduler.RecordReview(p, 10, 10);

            if (p.NextReviewAt.HasValue)
                p.NextReviewAt.Value.Date.Should().BeAfter(DateTime.UtcNow.Date,
                    $"stage {stage}→{stage + 1}: NextReviewAt must be in the future");
        }
    }

    // ── Missed-day shift behaviour ─────────────────────────────────────────────

    [Fact]
    public void RecordReview_LateStudy_ShiftsSchedule_WithoutSkippingStages()
    {
        // User first studied May 23 (stage 1, due May 24).
        // Missed May 24, studied May 25 (1 day late).
        // Expected: advance to stage 2, NextReviewAt = May 25 + 1 = May 26
        //           (not May 24 or May 25, which would show as immediately due again)
        var p = MakeProgress(stage: 1, daysAgo: 2); // NextReviewAt = yesterday (1 day overdue)

        ReviewScheduler.RecordReview(p, 10, 10);

        p.ReviewStage.Should().Be(2);
        p.NextReviewAt!.Value.Date.Should().Be(DateTime.UtcNow.Date.AddDays(1),
            "late study shifts the next review to tomorrow, not to a past date");
    }

    [Fact]
    public void RecordReview_WithoutMissedDays_FollowsStandardSchedule()
    {
        // Simulate perfect schedule: each review happens exactly on the due date.
        // With relative intervals, NextReviewAt is always computed from the actual
        // study date (today in tests), so all expected dates are relative to today.
        //
        // Intervals: [1, 1, 2, 3, 7]
        //   stage 1 done → today + 1
        //   stage 2 done → today + 1
        //   stage 3 done → today + 2
        //   stage 4 done → today + 3
        //   stage 5 done → null (complete)
        var today = DateTime.UtcNow.Date;

        var p = MakeProgress(stage: 1, daysAgo: 1); // NextReviewAt = today → due

        // Stage 1 → 2
        ReviewScheduler.RecordReview(p, 10, 10);
        p.ReviewStage.Should().Be(2);
        p.NextReviewAt!.Value.Date.Should().Be(today.AddDays(1)); // Intervals[1] = 1

        // Stage 2 → 3: mark as due today and review again
        p.NextReviewAt = today; // simulate arriving at the due date
        ReviewScheduler.RecordReview(p, 10, 10);
        p.ReviewStage.Should().Be(3);
        p.NextReviewAt!.Value.Date.Should().Be(today.AddDays(2)); // Intervals[2] = 2

        // Stage 3 → 4
        p.NextReviewAt = today;
        ReviewScheduler.RecordReview(p, 10, 10);
        p.ReviewStage.Should().Be(4);
        p.NextReviewAt!.Value.Date.Should().Be(today.AddDays(3)); // Intervals[3] = 3

        // Stage 4 → 5
        p.NextReviewAt = today;
        ReviewScheduler.RecordReview(p, 10, 10);
        p.ReviewStage.Should().Be(5);
        p.NextReviewAt!.Value.Date.Should().Be(today.AddDays(7)); // Intervals[4] = 7

        // Stage 5 → 6: complete
        p.NextReviewAt = today;
        ReviewScheduler.RecordReview(p, 10, 10);
        p.ReviewStage.Should().Be(6);
        p.NextReviewAt.Should().BeNull("stage 6 is the final stage");
    }

    // ── IsExpired ──────────────────────────────────────────────────────────────

    [Fact]
    public void IsExpired_Returns_False_When_Not_Overdue()
    {
        var p = MakeProgress(stage: 1, daysAgo: 1); // due today, not expired

        ReviewScheduler.IsExpired(p).Should().BeFalse();
    }

    [Fact]
    public void IsExpired_Returns_False_Within_Grace_Period()
    {
        var p = MakeProgress(stage: 1, daysAgo: ReviewScheduler.GracePeriodDays); // exactly at grace limit

        ReviewScheduler.IsExpired(p).Should().BeFalse();
    }

    [Fact]
    public void IsExpired_Returns_True_Beyond_Grace_Period()
    {
        var p = MakeProgress(stage: 1, daysAgo: 0);
        p.NextReviewAt = DateTime.UtcNow.Date.AddDays(-(ReviewScheduler.GracePeriodDays + 1));

        ReviewScheduler.IsExpired(p).Should().BeTrue();
    }

    [Fact]
    public void IsExpired_Returns_False_When_NextReviewAt_Is_Null()
    {
        var p = MakeProgress(stage: 6, daysAgo: 0);
        p.NextReviewAt = null;

        ReviewScheduler.IsExpired(p).Should().BeFalse();
    }

    // ── Reset ──────────────────────────────────────────────────────────────────

    [Fact]
    public void Reset_Sets_Stage_To_Zero_And_Clears_NextReviewAt()
    {
        var p = MakeProgress(stage: 2, daysAgo: 5);

        ReviewScheduler.Reset(p);

        p.ReviewStage.Should().Be(0);
        p.NextReviewAt.Should().BeNull();
        p.KnownCount.Should().Be(0);
    }

    // ── Restart ────────────────────────────────────────────────────────────────

    [Fact]
    public void Restart_Resets_To_Stage1_With_New_FirstStudiedAt()
    {
        var p = MakeProgress(stage: 0, daysAgo: 10);
        p.NextReviewAt = null;
        var oldFirst = p.FirstStudiedAt;

        ReviewScheduler.Restart(p, knownCount: 9, totalWords: 10);

        p.ReviewStage.Should().Be(1);
        p.NextReviewAt.Should().NotBeNull();
        p.FirstStudiedAt.Should().BeAfter(oldFirst);
        p.KnownCount.Should().Be(9);
    }

    // ── IsExpired → Restart integration ───────────────────────────────────────

    [Fact]
    public void Expired_Progress_Should_Be_Restarted_Not_Advanced()
    {
        var p = MakeProgress(stage: 2, daysAgo: 0);
        p.NextReviewAt = DateTime.UtcNow.Date.AddDays(-(ReviewScheduler.GracePeriodDays + 1));
        var oldFirst = p.FirstStudiedAt;

        ReviewScheduler.IsExpired(p).Should().BeTrue();

        ReviewScheduler.Restart(p, knownCount: 8, totalWords: 10);

        p.ReviewStage.Should().Be(1, "cycle restarts from stage 1 after expiry");
        p.NextReviewAt.Should().NotBeNull();
        p.KnownCount.Should().Be(8);
        p.FirstStudiedAt.Should().BeAfter(oldFirst, "FirstStudiedAt is reset to now");
    }

    [Fact]
    public void Non_Expired_Overdue_Progress_Should_Advance_Not_Restart()
    {
        var p = MakeProgress(stage: 2, daysAgo: 0);
        p.NextReviewAt = DateTime.UtcNow.Date.AddDays(-ReviewScheduler.GracePeriodDays);

        ReviewScheduler.IsExpired(p).Should().BeFalse();

        ReviewScheduler.RecordReview(p, knownCount: 10, totalWords: 10);

        p.ReviewStage.Should().Be(3, "overdue within grace period still advances the stage");
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Creates a SetProgress with NextReviewAt = today + 1 - daysAgo
    /// (daysAgo=1 → due today; daysAgo=2 → due yesterday; daysAgo=0 → due tomorrow).
    /// </summary>
    private static SetProgress MakeProgress(int stage, int daysAgo)
    {
        var nextReview = DateTime.UtcNow.Date.AddDays(-daysAgo + 1);
        var firstStudied = DateTime.UtcNow.AddDays(-30); // FirstStudiedAt is for display only now

        return new SetProgress
        {
            Id = Guid.NewGuid(),
            UserId = UserId,
            SetId = SetId,
            ReviewStage = stage,
            FirstStudiedAt = firstStudied,
            LastStudiedAt = DateTime.UtcNow.AddDays(-daysAgo),
            NextReviewAt = nextReview,
            KnownCount = 5,
            TotalWords = 10,
        };
    }
}
