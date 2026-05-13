namespace VocabApp.API.Models;

public class WordProgress
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid WordId { get; set; }
    public int KnownCount { get; set; }
    public int UnknownCount { get; set; }
    public DateTime LastSeenAt { get; set; }

    public User User { get; set; } = null!;
    public Word Word { get; set; } = null!;
}
