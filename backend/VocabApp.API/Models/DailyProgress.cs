namespace VocabApp.API.Models;

public class DailyProgress
{
    public Guid UserId { get; set; }
    public DateOnly Date { get; set; }
    public int WordCount { get; set; }

    public User User { get; set; } = null!;
}
