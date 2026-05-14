using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace VocabApp.API.Controllers;

[ApiController]
[Route("api/tts")]
[Authorize]
public class TtsController(IHttpClientFactory httpClientFactory, IConfiguration config) : ControllerBase
{
    private static readonly HashSet<string> AllowedLangs =
        ["de-DE", "ru-RU", "en-US", "en-GB", "fr-FR", "es-ES", "it-IT"];

    [HttpPost]
    public async Task<IActionResult> Synthesize(TtsRequest req)
    {
        var apiKey = config["Google:TtsApiKey"];
        if (string.IsNullOrEmpty(apiKey))
            return StatusCode(503, new { message = "TTS not configured" });

        if (string.IsNullOrWhiteSpace(req.Text))
            return BadRequest();

        // Validate lang or fall back to de-DE
        var lang = AllowedLangs.Contains(req.Lang ?? "") ? req.Lang! : "de-DE";

        var url = $"https://texttospeech.googleapis.com/v1/text:synthesize?key={apiKey}";

        var body = new
        {
            input = new { text = req.Text.Trim() },
            voice = new { languageCode = lang, ssmlGender = "NEUTRAL" },
            audioConfig = new { audioEncoding = "MP3", speakingRate = 0.9 }
        };

        var client = httpClientFactory.CreateClient();
        HttpResponseMessage response;
        try
        {
            response = await client.PostAsJsonAsync(url, body);
        }
        catch
        {
            return StatusCode(502, new { message = "TTS upstream error" });
        }

        if (!response.IsSuccessStatusCode)
            return StatusCode((int)response.StatusCode, new { message = "TTS API error" });

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var audioContent = json.GetProperty("audioContent").GetString()!;

        // Return base64 so frontend can create a data URL without extra parsing
        return Ok(new { audioContent });
    }
}

public record TtsRequest(
    [Required, MaxLength(500)] string Text,
    string? Lang
);
