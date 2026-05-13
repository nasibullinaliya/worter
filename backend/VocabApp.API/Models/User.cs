namespace VocabApp.API.Models;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = null!;
    public string? GoogleId { get; set; }
    public string? Name { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; }

    public ICollection<WordSet> OwnedSets { get; set; } = [];
    public ICollection<UserSet> SavedSets { get; set; } = [];
    public ICollection<SetProgress> Progress { get; set; } = [];
    public ICollection<WordProgress> WordProgress { get; set; } = [];
}
