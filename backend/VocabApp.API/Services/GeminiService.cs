using System.Text;
using System.Text.Json;

namespace VocabApp.API.Services;

public class GeminiService(IConfiguration config, HttpClient http, ILogger<GeminiService> logger)
{
    private const string Model = "llama-3.3-70b-versatile";
    private const string BaseUrl = "https://api.groq.com/openai/v1/chat/completions";

    public async Task<string> GenerateTextAsync(
        IEnumerable<string> words,
        string language,
        string level,
        int sentenceCount,
        CancellationToken ct = default)
    {
        var apiKey = config["Groq:ApiKey"];
        logger.LogInformation("Groq API key present: {Present}", !string.IsNullOrWhiteSpace(apiKey));
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("Groq API key is not configured.");

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
            model = Model,
            messages = new[]
            {
                new { role = "user", content = prompt }
            },
            temperature = 0.7,
            max_tokens = 1024
        });

        var request = new HttpRequestMessage(HttpMethod.Post, BaseUrl)
        {
            Content = new StringContent(requestBody, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("Authorization", $"Bearer {apiKey}");

        var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(ct);
            logger.LogError("Groq API returned {Status}: {Body}", (int)response.StatusCode, errorBody);
            response.EnsureSuccessStatusCode();
        }

        var json = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(json);

        return doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? string.Empty;
    }
}
