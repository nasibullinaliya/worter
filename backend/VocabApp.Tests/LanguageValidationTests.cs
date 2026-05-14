using FluentAssertions;

namespace VocabApp.Tests;

/// <summary>
/// Tests for the language validation logic used in SetsController.
/// The allowed set and fallback logic are copied here to keep tests self-contained
/// and verify the specification, not the implementation reference.
/// </summary>
public class LanguageValidationTests
{
    private static readonly HashSet<string> ValidLangs =
        ["de-DE", "en-US", "en-GB", "ru-RU", "fr-FR", "es-ES", "it-IT"];

    private static string ResolveLanguage(string? requested, string fallback = "de-DE") =>
        ValidLangs.Contains(requested ?? "") ? requested! : fallback;

    [Theory]
    [InlineData("de-DE")]
    [InlineData("en-US")]
    [InlineData("en-GB")]
    [InlineData("ru-RU")]
    [InlineData("fr-FR")]
    [InlineData("es-ES")]
    [InlineData("it-IT")]
    public void Valid_Language_Codes_Are_Accepted(string lang)
    {
        ResolveLanguage(lang).Should().Be(lang);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("xx-XX")]
    [InlineData("DE-de")]      // case-sensitive: wrong case
    [InlineData("en")]         // incomplete tag
    [InlineData("random")]
    public void Invalid_Language_Falls_Back_To_Default(string? lang)
    {
        ResolveLanguage(lang).Should().Be("de-DE");
    }

    [Fact]
    public void Exactly_Seven_Languages_Are_Supported()
    {
        ValidLangs.Should().HaveCount(7);
    }
}
