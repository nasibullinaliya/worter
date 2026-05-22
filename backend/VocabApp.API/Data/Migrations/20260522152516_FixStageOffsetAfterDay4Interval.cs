using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VocabApp.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class FixStageOffsetAfterDay4Interval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // When the day-4 interval was added to the SRS chain (commit 6ddb48d, deployed 2026-05-16),
            // existing records were not migrated. Users who had stage 2→3 computed with the OLD
            // intervals [1, 2, 7, 14] got NextReviewAt = FirstStudiedAt + 7 days, which in the NEW
            // system [1, 2, 4, 7, 14] corresponds to stage 4, not stage 3.
            //
            // Fix A: stage=3, NextReviewAt = FirstStudiedAt + 7 days (set with old intervals)
            //        → advance to stage=4, keep NextReviewAt (aligns with new Intervals[3] = 7)
            migrationBuilder.Sql("""
                UPDATE "SetProgress"
                SET "ReviewStage" = 4
                WHERE "ReviewStage" = 3
                  AND "NextReviewAt" IS NOT NULL
                  AND date_trunc('day', "NextReviewAt") = date_trunc('day', "FirstStudiedAt") + INTERVAL '7 days';
                """);

            // Fix B: stage=4, NextReviewAt = FirstStudiedAt + 7 days AND already studied today
            //        → these users hit the bug today (advanced 3→4 with nextReview landing on today)
            //        → advance to stage=5, NextReviewAt = FirstStudiedAt + 14 days
            migrationBuilder.Sql("""
                UPDATE "SetProgress"
                SET "ReviewStage" = 5,
                    "NextReviewAt" = date_trunc('day', "FirstStudiedAt") + INTERVAL '14 days'
                WHERE "ReviewStage" = 4
                  AND "NextReviewAt" IS NOT NULL
                  AND date_trunc('day', "NextReviewAt") = date_trunc('day', "FirstStudiedAt") + INTERVAL '7 days'
                  AND date_trunc('day', "LastStudiedAt") = CURRENT_DATE;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data fix — not reversible
        }
    }
}
