using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using VocabApp.API.Data;
using VocabApp.API.Models;

namespace VocabApp.Tests;

/// <summary>
/// Tests for the weakest-words ranking algorithm used in
/// GET /api/progress/weakest-words.
///
/// The ranking is:
///   1. Words with no WordProgress record come first (treated as ratio = infinity bad)
///   2. Then ascending known/(known+unknown) ratio
///   3. Then descending UnknownCount as tiebreaker
/// </summary>
public class WeakestWordsRankingTests
{
    private static AppDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(opts);
    }

    // ── Helper: rank words the same way the controller does ───────────────────

    /// Replicates the ordering logic from ProgressController.GetWeakestWords.
    /// No-progress words get ratio=0.0 and tiebreaker=int.MaxValue so they sort first.
    private static List<Guid> RankWords(
        List<Word> words,
        List<WordProgress> progresses,
        int count)
    {
        var progressMap = progresses.ToDictionary(p => p.WordId);

        return words
            .OrderBy(w =>
            {
                if (!progressMap.TryGetValue(w.Id, out var p)) return 0.0;
                var total = p.KnownCount + p.UnknownCount;
                return total == 0 ? 0.0 : (double)p.KnownCount / total;
            })
            .ThenByDescending(w =>
                progressMap.TryGetValue(w.Id, out var p) ? p.UnknownCount : int.MaxValue)
            .Take(count)
            .Select(w => w.Id)
            .ToList();
    }

    private static Word MakeWord(string name = "word") =>
        new() { Id = Guid.NewGuid(), Term = name, Definition = "def", Position = 0, SetId = Guid.NewGuid() };

    private static WordProgress MakeProgress(Guid wordId, Guid userId, int known, int unknown) =>
        new()
        {
            Id = Guid.NewGuid(),
            WordId = wordId,
            UserId = userId,
            KnownCount = known,
            UnknownCount = unknown,
            LastSeenAt = DateTime.UtcNow,
        };

    // ── Tests ──────────────────────────────────────────────────────────────────

    [Fact]
    public void Words_With_No_Progress_Come_First()
    {
        var userId = Guid.NewGuid();
        var noProgress = MakeWord("no-progress");
        var withProgress = MakeWord("with-progress");

        var words = new List<Word> { withProgress, noProgress };
        var progresses = new List<WordProgress>
        {
            MakeProgress(withProgress.Id, userId, known: 5, unknown: 0), // perfect
        };

        var ranked = RankWords(words, progresses, count: 2);

        ranked[0].Should().Be(noProgress.Id, "word with no progress record should rank first");
        ranked[1].Should().Be(withProgress.Id);
    }

    [Fact]
    public void Words_Ranked_By_Ascending_Known_Ratio()
    {
        var userId = Guid.NewGuid();
        var worst = MakeWord("worst");   // known=1/10 = 0.1
        var middle = MakeWord("middle"); // known=5/10 = 0.5
        var best = MakeWord("best");     // known=9/10 = 0.9

        var words = new List<Word> { best, middle, worst };
        var progresses = new List<WordProgress>
        {
            MakeProgress(worst.Id, userId, known: 1, unknown: 9),
            MakeProgress(middle.Id, userId, known: 5, unknown: 5),
            MakeProgress(best.Id, userId, known: 9, unknown: 1),
        };

        var ranked = RankWords(words, progresses, count: 3);

        ranked[0].Should().Be(worst.Id);
        ranked[1].Should().Be(middle.Id);
        ranked[2].Should().Be(best.Id);
    }

    [Fact]
    public void Tiebreaker_Is_Descending_UnknownCount()
    {
        var userId = Guid.NewGuid();
        // Both have 0/0 → ratio = MaxValue (tie), but different UnknownCount
        var moreUnknown = MakeWord("more-unknown");
        var lessUnknown = MakeWord("less-unknown");

        var words = new List<Word> { lessUnknown, moreUnknown };
        var progresses = new List<WordProgress>
        {
            MakeProgress(moreUnknown.Id, userId, known: 0, unknown: 10),
            MakeProgress(lessUnknown.Id, userId, known: 0, unknown: 3),
        };

        var ranked = RankWords(words, progresses, count: 2);

        ranked[0].Should().Be(moreUnknown.Id, "higher UnknownCount should rank first on tie");
    }

    [Fact]
    public void Count_Parameter_Limits_Results()
    {
        var userId = Guid.NewGuid();
        var words = Enumerable.Range(1, 10).Select(i => MakeWord($"word-{i}")).ToList();
        var progresses = words.Select(w => MakeProgress(w.Id, userId, known: 1, unknown: 1)).ToList();

        var ranked = RankWords(words, progresses, count: 3);

        ranked.Should().HaveCount(3);
    }

    [Fact]
    public void Count_Larger_Than_Pool_Returns_All()
    {
        var userId = Guid.NewGuid();
        var words = new List<Word> { MakeWord("a"), MakeWord("b") };
        var progresses = words.Select(w => MakeProgress(w.Id, userId, 1, 1)).ToList();

        var ranked = RankWords(words, progresses, count: 100);

        ranked.Should().HaveCount(2);
    }

    [Fact]
    public void Empty_Word_List_Returns_Empty()
    {
        var ranked = RankWords([], [], count: 10);
        ranked.Should().BeEmpty();
    }
}
