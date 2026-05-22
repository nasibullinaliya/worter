namespace VocabApp.API.Models;

public class SetStudyLog
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid SetId { get; set; }
    public DateTime StudiedAt { get; set; }       // UTC timestamp of the session
    public int StageBefore { get; set; }          // stage BEFORE this session
    public int StageAfter { get; set; }           // stage AFTER this session
    public DateTime? NextReviewAtAfter { get; set; } // NextReviewAt set after this session
    public int KnownCount { get; set; }
    public int TotalWords { get; set; }

    public User User { get; set; } = null!;
    public WordSet Set { get; set; } = null!;
}
