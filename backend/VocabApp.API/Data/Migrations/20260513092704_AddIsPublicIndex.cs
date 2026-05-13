using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VocabApp.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddIsPublicIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_WordSets_IsPublic",
                table: "WordSets",
                column: "IsPublic");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WordSets_IsPublic",
                table: "WordSets");
        }
    }
}
