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
        // Stage 1 → due → stage 2
        var p = MakeProgress(stage: 1, daysAgo: 1);
        ReviewScheduler.RecordReview(p, 10, 10);
        p.ReviewStage.Should().Be(2);

        // Simulate stage 2 due (NextReviewAt in the past)
        p.NextReviewAt = DateTime.UtcNow.Date.AddDays(-1);
        ReviewScheduler.RecordReview(p, 10, 10);
        p.ReviewStage.Should().Be(3);

        // Simulate stage 3 due
        p.NextReviewAt = DateTime.UtcNow.Date.AddDays(-1);
        ReviewScheduler.RecordReview(p, 10, 10);
        p.ReviewStage.Should().Be(4);
        p.NextReviewAt.Should().BeNull("stage 4 is the final stage");
    }

    [Fact]
    public void RecordReview_Stage4_NextReviewAt_Stays_Null()
    {
        var p = MakeProgress(stage: 4, daysAgo: 0);
        p.NextReviewAt = null; // stage 4 has no next review

        ReviewScheduler.RecordReview(p, 10, 10);

        p.ReviewStage.Should().Be(4);
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

    // ── NextReviewAt intervals ─────────────────────────────────────────────────

    [Theory]
    [InlineData(1, 7)]   // stage 2 → FirstStudiedAt + 7 days
    [InlineData(2, 14)]  // stage 3 → FirstStudiedAt + 14 days
    public void RecordReview_Sets_Correct_Interval(int currentStage, int expectedDaysFromFirst)
    {
        var p = MakeProgress(stage: currentStage, daysAgo: 1);

        ReviewScheduler.RecordReview(p, 10, 10);

        var expectedDate = p.FirstStudiedAt.Date.AddDays(expectedDaysFromFirst);
        p.NextReviewAt!.Value.Date.Should().Be(expectedDate);
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
        // Set NextReviewAt far enough in the past to exceed the grace period
        p.NextReviewAt = DateTime.UtcNow.Date.AddDays(-(ReviewScheduler.GracePeriodDays + 1));

        ReviewScheduler.IsExpired(p).Should().BeTrue();
    }

    [Fact]
    public void IsExpired_Returns_False_When_NextReviewAt_Is_Null()
    {
        var p = MakeProgress(stage: 4, daysAgo: 0);
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

    // ── Helpers ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Creates a SetProgress with NextReviewAt set to `daysAgo` days in the past
    /// (so ReviewAt.Date + daysAgo = today, meaning it was due `daysAgo` days ago).
    /// </summary>
    private static SetProgress MakeProgress(int stage, int daysAgo)
    {
        var firstStudied = DateTime.UtcNow.AddDays(-30);
        return new SetProgress
        {
            Id = Guid.NewGuid(),
            UserId = UserId,
            SetId = SetId,
            ReviewStage = stage,
            FirstStudiedAt = firstStudied,
            LastStudiedAt = DateTime.UtcNow.AddDays(-daysAgo),
            NextReviewAt = DateTime.UtcNow.Date.AddDays(-daysAgo + 1),
            KnownCount = 5,
            TotalWords = 10,
        };
    }
}
