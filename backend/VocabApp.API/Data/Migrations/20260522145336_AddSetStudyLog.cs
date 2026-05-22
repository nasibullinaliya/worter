using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VocabApp.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSetStudyLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SetStudyLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SetId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StageBefore = table.Column<int>(type: "integer", nullable: false),
                    StageAfter = table.Column<int>(type: "integer", nullable: false),
                    NextReviewAtAfter = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    KnownCount = table.Column<int>(type: "integer", nullable: false),
                    TotalWords = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SetStudyLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SetStudyLogs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SetStudyLogs_WordSets_SetId",
                        column: x => x.SetId,
                        principalTable: "WordSets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SetStudyLogs_SetId",
                table: "SetStudyLogs",
                column: "SetId");

            migrationBuilder.CreateIndex(
                name: "IX_SetStudyLogs_UserId_SetId",
                table: "SetStudyLogs",
                columns: new[] { "UserId", "SetId" });

            migrationBuilder.CreateIndex(
                name: "IX_SetStudyLogs_UserId_SetId_StudiedAt",
                table: "SetStudyLogs",
                columns: new[] { "UserId", "SetId", "StudiedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SetStudyLogs");
        }
    }
}
