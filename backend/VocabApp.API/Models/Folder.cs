namespace VocabApp.API.Models;

public class Folder
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public ICollection<WordSet> Sets { get; set; } = [];
}
