using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VocabApp.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WordSets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    IsPublic = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WordSets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WordSets_Users_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SetProgress",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SetId = table.Column<Guid>(type: "uuid", nullable: false),
                    FirstStudiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastStudiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NextReviewAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewStage = table.Column<int>(type: "integer", nullable: false),
                    KnownCount = table.Column<int>(type: "integer", nullable: false),
                    TotalWords = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SetProgress", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SetProgress_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SetProgress_WordSets_SetId",
                        column: x => x.SetId,
                        principalTable: "WordSets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserSets",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SetId = table.Column<Guid>(type: "uuid", nullable: false),
                    AddedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSets", x => new { x.UserId, x.SetId });
                    table.ForeignKey(
                        name: "FK_UserSets_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserSets_WordSets_SetId",
                        column: x => x.SetId,
                        principalTable: "WordSets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Words",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Term = table.Column<string>(type: "text", nullable: false),
                    Definition = table.Column<string>(type: "text", nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    SetId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Words", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Words_WordSets_SetId",
                        column: x => x.SetId,
                        principalTable: "WordSets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WordProgress",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    WordId = table.Column<Guid>(type: "uuid", nullable: false),
                    KnownCount = table.Column<int>(type: "integer", nullable: false),
                    UnknownCount = table.Column<int>(type: "integer", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WordProgress", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WordProgress_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WordProgress_Words_WordId",
                        column: x => x.WordId,
                        principalTable: "Words",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SetProgress_SetId",
                table: "SetProgress",
                column: "SetId");

            migrationBuilder.CreateIndex(
                name: "IX_SetProgress_UserId_NextReviewAt",
                table: "SetProgress",
                columns: new[] { "UserId", "NextReviewAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SetProgress_UserId_SetId",
                table: "SetProgress",
                columns: new[] { "UserId", "SetId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserSets_SetId",
                table: "UserSets",
                column: "SetId");

            migrationBuilder.CreateIndex(
                name: "IX_WordProgress_UserId_WordId",
                table: "WordProgress",
                columns: new[] { "UserId", "WordId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WordProgress_WordId",
                table: "WordProgress",
                column: "WordId");

            migrationBuilder.CreateIndex(
                name: "IX_Words_SetId",
                table: "Words",
                column: "SetId");

            migrationBuilder.CreateIndex(
                name: "IX_WordSets_OwnerId",
                table: "WordSets",
                column: "OwnerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SetProgress");

            migrationBuilder.DropTable(
                name: "UserSets");

            migrationBuilder.DropTable(
                name: "WordProgress");

            migrationBuilder.DropTable(
                name: "Words");

            migrationBuilder.DropTable(
                name: "WordSets");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
