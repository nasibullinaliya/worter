namespace VocabApp.API.Models;

public class UserSet
{
    public Guid UserId { get; set; }
    public Guid SetId { get; set; }
    public DateTime AddedAt { get; set; }

    public User User { get; set; } = null!;
    public WordSet Set { get; set; } = null!;
}
