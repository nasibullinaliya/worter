using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace VocabApp.API.Services;

public class GeminiService(IConfiguration config, HttpClient http)
{
    private const string Model = "gemini-2.0-flash";

    public async Task<string> GenerateTextAsync(
        IEnumerable<string> words,
        string language,
        string level,
        int sentenceCount,
        CancellationToken ct = default)
    {
        var apiKey = config["Gemini:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("Gemini API key is not configured.");

        var wordList = string.Join(", ", words);
        var langName = language switch
        {
            "de-DE" or "de" => "German",
            "en-US" or "en" => "English",
            "fr-FR" or "fr" => "French",
            "es-ES" or "es" => "Spanish",
            _ => "German"
        };

        var prompt = $"""
            Write a simple {level}-level {langName} text ({sentenceCount} sentences).
            Use as many of these words as possible (at least half of them): {wordList}.
            Wrap each used word in **bold** (markdown).
            Use only simple vocabulary and short sentences appropriate for {level} level.
            Return only the text, no explanations.
            """;

        var requestBody = JsonSerializer.Serialize(new
        {
            contents = new[]
            {
                new { parts = new[] { new { text = prompt } } }
            }
        });

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{Model}:generateContent?key={apiKey}";
        var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(requestBody, Encoding.UTF8, "application/json")
        };

        var response = await http.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(json);

        return doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString() ?? string.Empty;
    }
}
