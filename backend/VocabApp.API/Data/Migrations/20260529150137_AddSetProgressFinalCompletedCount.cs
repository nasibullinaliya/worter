using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VocabApp.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSetProgressFinalCompletedCount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FinalCompletedCount",
                table: "SetProgress",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Backfill: compute FinalCompletedCount from existing WordProgress data
            migrationBuilder.Sql(@"
                UPDATE ""SetProgress"" sp
                SET ""FinalCompletedCount"" = (
                    SELECT COUNT(*)
                    FROM ""WordProgress"" wp
                    INNER JOIN ""Words"" w ON wp.""WordId"" = w.""Id""
                    WHERE wp.""UserId"" = sp.""UserId""
                      AND w.""SetId"" = sp.""SetId""
                      AND wp.""IsFinalCompleted"" = true
                )
                WHERE sp.""ReviewStage"" >= 5;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FinalCompletedCount",
                table: "SetProgress");
        }
    }
}
