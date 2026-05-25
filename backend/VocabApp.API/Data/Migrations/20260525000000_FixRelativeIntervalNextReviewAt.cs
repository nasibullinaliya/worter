using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VocabApp.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class FixRelativeIntervalNextReviewAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // SRS intervals were changed from absolute (FirstStudiedAt + fixed offset) to
            // relative (LastStudiedAt + per-stage offset). With the old system, studying late
            // could produce NextReviewAt = today, making the set re-appear in reminders
            // immediately after being studied.
            //
            // Fix: for any active record where NextReviewAt is on or before the last study date
            // (impossible with relative intervals — next review must always be after study date),
            // recompute NextReviewAt as LastStudiedAt.Date + Intervals[stage-1].
            //
            // New intervals: stage 1→+1d, 2→+1d, 3→+2d, 4→+3d, 5→+7d
            migrationBuilder.Sql("""
                UPDATE "SetProgress"
                SET "NextReviewAt" = date_trunc('day', "LastStudiedAt") + (
                    CASE "ReviewStage"
                        WHEN 1 THEN INTERVAL '1 day'
                        WHEN 2 THEN INTERVAL '1 day'
                        WHEN 3 THEN INTERVAL '2 days'
                        WHEN 4 THEN INTERVAL '3 days'
                        WHEN 5 THEN INTERVAL '7 days'
                    END
                )
                WHERE "ReviewStage" BETWEEN 1 AND 5
                  AND "NextReviewAt" IS NOT NULL
                  AND date_trunc('day', "NextReviewAt") <= date_trunc('day', "LastStudiedAt");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data fix — not reversible
        }
    }
}
