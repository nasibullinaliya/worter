using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VocabApp.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class FixSetProgressDates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Fix 1: stage=0 but NextReviewAt is not null → reset to null (corrupted state after grace-period reset)
            migrationBuilder.Sql("""
                UPDATE "SetProgress"
                SET "NextReviewAt" = NULL
                WHERE "ReviewStage" = 0 AND "NextReviewAt" IS NOT NULL;
                """);

            // Fix 2: NextReviewAt stored with time component → truncate to date (midnight UTC).
            // Before the SRS date-only fix, timestamps like '2026-05-13 16:32:00' were stored,
            // causing the due-today check to fail until that exact time had passed.
            migrationBuilder.Sql("""
                UPDATE "SetProgress"
                SET "NextReviewAt" = DATE_TRUNC('day', "NextReviewAt")
                WHERE "NextReviewAt" IS NOT NULL
                  AND "NextReviewAt" <> DATE_TRUNC('day', "NextReviewAt");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data fixes are not reversible
        }
    }
}
