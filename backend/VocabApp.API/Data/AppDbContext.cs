using Microsoft.EntityFrameworkCore;
using VocabApp.API.Models;

namespace VocabApp.API.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<WordSet> WordSets => Set<WordSet>();
    public DbSet<Word> Words => Set<Word>();
    public DbSet<UserSet> UserSets => Set<UserSet>();
    public DbSet<SetProgress> SetProgress => Set<SetProgress>();
    public DbSet<WordProgress> WordProgress => Set<WordProgress>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.HasKey(u => u.Id);
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.CreatedAt).HasDefaultValueSql("now()");
        });

        b.Entity<WordSet>(e =>
        {
            e.HasKey(s => s.Id);
            e.HasIndex(s => s.IsPublic);
            e.Property(s => s.CreatedAt).HasDefaultValueSql("now()");
            e.Property(s => s.UpdatedAt).HasDefaultValueSql("now()");
            e.HasOne(s => s.Owner)
             .WithMany(u => u.OwnedSets)
             .HasForeignKey(s => s.OwnerId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Word>(e =>
        {
            e.HasKey(w => w.Id);
            e.HasOne(w => w.Set)
             .WithMany(s => s.Words)
             .HasForeignKey(w => w.SetId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<UserSet>(e =>
        {
            e.HasKey(us => new { us.UserId, us.SetId });
            e.Property(us => us.AddedAt).HasDefaultValueSql("now()");
            e.HasOne(us => us.User)
             .WithMany(u => u.SavedSets)
             .HasForeignKey(us => us.UserId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(us => us.Set)
             .WithMany(s => s.SavedBy)
             .HasForeignKey(us => us.SetId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<SetProgress>(e =>
        {
            e.HasKey(p => p.Id);
            e.HasIndex(p => new { p.UserId, p.SetId }).IsUnique();
            e.HasIndex(p => new { p.UserId, p.NextReviewAt });
            e.HasOne(p => p.User)
             .WithMany(u => u.Progress)
             .HasForeignKey(p => p.UserId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(p => p.Set)
             .WithMany(s => s.Progress)
             .HasForeignKey(p => p.SetId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<WordProgress>(e =>
        {
            e.HasKey(p => p.Id);
            e.HasIndex(p => new { p.UserId, p.WordId }).IsUnique();
            e.Property(p => p.LastSeenAt).HasDefaultValueSql("now()");
            e.HasOne(p => p.User)
             .WithMany(u => u.WordProgress)
             .HasForeignKey(p => p.UserId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(p => p.Word)
             .WithMany(w => w.Progress)
             .HasForeignKey(p => p.WordId)
             .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
