using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VocabApp.API.Data.Migrations;

public partial class AddLanguageToWordSets : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "Language",
            table: "WordSets",
            type: "character varying(10)",
            maxLength: 10,
            nullable: false,
            defaultValue: "de-DE");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "Language",
            table: "WordSets");
    }
}
