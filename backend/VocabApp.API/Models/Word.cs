namespace VocabApp.API.Models;

public class Word
{
    public Guid Id { get; set; }
    public string Term { get; set; } = null!;
    public string Definition { get; set; } = null!;
    public int Position { get; set; }

    public Guid SetId { get; set; }
    public WordSet Set { get; set; } = null!;

    public ICollection<WordProgress> Progress { get; set; } = [];
}
