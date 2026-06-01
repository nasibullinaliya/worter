using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VocabApp.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUserSetFolderId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FolderId",
                table: "UserSets",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserSets_FolderId",
                table: "UserSets",
                column: "FolderId");

            migrationBuilder.AddForeignKey(
                name: "FK_UserSets_Folders_FolderId",
                table: "UserSets",
                column: "FolderId",
                principalTable: "Folders",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserSets_Folders_FolderId",
                table: "UserSets");

            migrationBuilder.DropIndex(
                name: "IX_UserSets_FolderId",
                table: "UserSets");

            migrationBuilder.DropColumn(
                name: "FolderId",
                table: "UserSets");
        }
    }
}
