using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using VocabApp.API.Data;
using VocabApp.API.DTOs;
using VocabApp.API.Models;

namespace VocabApp.API.Services;

public class AuthService(AppDbContext db, IConfiguration config)
{
    public async Task<AuthResponse> RegisterAsync(RegisterRequest req)
    {
        if (await db.Users.AnyAsync(u => u.Email == req.Email))
            throw new InvalidOperationException("Email already registered.");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = req.Email.ToLower().Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Name = req.Name?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return new AuthResponse(GenerateToken(user), ToDto(user));
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email.ToLower().Trim())
            ?? throw new UnauthorizedAccessException("Invalid credentials.");

        if (!BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Invalid credentials.");

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
            claims: claims,
            expires: DateTime.UtcNow.AddDays(expiresDays),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static UserDto ToDto(User u) => new(u.Id, u.Email, u.Name, u.CreatedAt);
}
