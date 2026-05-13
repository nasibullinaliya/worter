namespace VocabApp.API.Models;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string? Name { get; set; }
    public DateTime CreatedAt { get; set; }

    public ICollection<WordSet> OwnedSets { get; set; } = [];
    public ICollection<UserSet> SavedSets { get; set; } = [];
    public ICollection<SetProgress> Progress { get; set; } = [];
    public ICollection<WordProgress> WordProgress { get; set; } = [];
}
