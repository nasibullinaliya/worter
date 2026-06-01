namespace VocabApp.API.Models;

public class WordSet
{
    public Guid Id { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsPublic { get; set; }
    public string Language { get; set; } = "de-DE";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Guid OwnerId { get; set; }
    public User Owner { get; set; } = null!;

    public Guid? FolderId { get; set; }
    public Folder? Folder { get; set; }

    public ICollection<Word> Words { get; set; } = [];
    public ICollection<UserSet> SavedBy { get; set; } = [];
    public ICollection<SetProgress> Progress { get; set; } = [];
}
