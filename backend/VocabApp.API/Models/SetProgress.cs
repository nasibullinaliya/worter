namespace VocabApp.API.Models;

public class SetProgress
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid SetId { get; set; }

    public DateTime FirstStudiedAt { get; set; }
    public DateTime LastStudiedAt { get; set; }
    public DateTime? NextReviewAt { get; set; }
    public int ReviewStage { get; set; }
    public int KnownCount { get; set; }
    public int TotalWords { get; set; }

    public User User { get; set; } = null!;
    public WordSet Set { get; set; } = null!;
}
