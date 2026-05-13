using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using VocabApp.API.Data;
using VocabApp.API.DTOs;
using VocabApp.API.Models;

namespace VocabApp.API.Services;

public class AuthService(AppDbContext db, IConfiguration config)
{
    public async Task<AuthResponse> GoogleLoginAsync(string idToken)
    {
        var clientId = config["Google:ClientId"]
            ?? throw new InvalidOperationException("Google:ClientId is not configured.");

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(idToken,
                new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = [clientId]
                });
        }
        catch (InvalidJwtException ex)
        {
            throw new UnauthorizedAccessException("Invalid Google token.", ex);
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == payload.Email);

        if (user == null)
        {
            user = new User
            {
                Id = Guid.NewGuid(),
                Email = payload.Email,
                GoogleId = payload.Subject,
                Name = payload.Name,
                AvatarUrl = payload.Picture,
                CreatedAt = DateTime.UtcNow
            };
            db.Users.Add(user);
        }
        else
        {
            user.GoogleId ??= payload.Subject;
            user.Name ??= payload.Name;
            user.AvatarUrl ??= payload.Picture;
        }

        await db.SaveChangesAsync();
        return new AuthResponse(GenerateToken(user), ToDto(user));
    }

    public async Task<UserDto> GetByIdAsync(Guid id)
    {
        var user = await db.Users.FindAsync(id)
            ?? throw new KeyNotFoundException("User not found.");
        return ToDto(user);
    }

    private string GenerateToken(User user)
    {
        var secret = config["Jwt:Secret"] ?? throw new InvalidOperationException("Jwt:Secret not configured.");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var expiresDays = int.TryParse(config["Jwt:ExpiresDays"], out var d) ? d : 7;

        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: "worter-app",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(expiresDays),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static UserDto ToDto(User u) => new(u.Id, u.Email, u.Name, u.AvatarUrl, u.CreatedAt);
}
