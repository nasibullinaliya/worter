# Database Schema

PostgreSQL. ORM: Entity Framework Core 8. All `DateTime` fields are stored as `timestamp with time zone` (UTC).

---

## Entity Relationship Diagram

```
Users
 ├── WordSets (OwnerId) — sets the user created
 ├── UserSets (UserId) — public sets the user saved
 ├── SetProgress (UserId) — SRS progress per set
 └── WordProgress (UserId) — per-word study statistics

WordSets
 ├── Words (SetId) — words in the set
 ├── UserSets (SetId) — users who saved this set
 ├── SetProgress (SetId) — users' progress on this set
 └── Owner → Users

Words
 ├── Set → WordSets
 └── WordProgress (WordId) — statistics for this word
```

---

## Tables

### `Users`

Application users. Authentication is via Google OAuth only — no passwords.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | `uuid` | PK | Unique user identifier |
| `Email` | `text` | NOT NULL, UNIQUE | Email from Google account |
| `GoogleId` | `text` | UNIQUE, nullable | `sub` from Google ID token. NULL for legacy records that predate Google auth |
| `Name` | `text` | nullable | Display name from Google profile |
| `AvatarUrl` | `text` | nullable | Avatar URL from Google profile |
| `CreatedAt` | `timestamptz` | NOT NULL, default `now()` | Registration date |

**Indexes:**
- `IX_Users_Email` — UNIQUE on `Email`
- `IX_Users_GoogleId` — UNIQUE on `GoogleId` (partial, only where `GoogleId IS NOT NULL`)

---

### `WordSets`

Word sets (study modules). Each set belongs to one owner.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | `uuid` | PK | Unique set identifier |
| `Title` | `text` | NOT NULL | Set title (max 200 characters at API level) |
| `Description` | `text` | nullable | Set description (max 2000 characters at API level) |
| `IsPublic` | `boolean` | NOT NULL | If `true` — the set is visible to everyone in Explore |
| `OwnerId` | `uuid` | NOT NULL, FK → `Users.Id` | Set owner |
| `Language` | `text` | NOT NULL, default `'de-DE'` | BCP-47 language tag for TTS. Supported values: `de-DE`, `en-US`, `en-GB`, `fr-FR`, `es-ES`, `it-IT` |
| `CreatedAt` | `timestamptz` | NOT NULL, default `now()` | Creation date |
| `UpdatedAt` | `timestamptz` | NOT NULL, default `now()` | Last modified date (updated manually on PUT) |

**Indexes:**
- `IX_WordSets_OwnerId` — for fast lookup of a user's sets
- `IX_WordSets_IsPublic` — for filtering public sets in Explore

**Cascade delete:** deleting `Users` → deletes all `WordSets` owned by that user.

---

### `Words`

Words inside a set. Each word belongs to one set.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | `uuid` | PK | Unique word identifier |
| `Term` | `text` | NOT NULL | Word / term (the thing being learned) |
| `Definition` | `text` | NOT NULL | Translation / definition |
| `Position` | `integer` | NOT NULL | Order of the word in the set (0-based), used for sorting |
| `SetId` | `uuid` | NOT NULL, FK → `WordSets.Id` | Set this word belongs to |

**Indexes:**
- `IX_Words_SetId` — for fast lookup of words in a set

**Cascade delete:** deleting `WordSets` → deletes all `Words` in that set.

---

### `UserSets`

Join table: "user saved someone else's set". Composite primary key.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `UserId` | `uuid` | PK, FK → `Users.Id` | User who saved the set |
| `SetId` | `uuid` | PK, FK → `WordSets.Id` | The saved set |
| `AddedAt` | `timestamptz` | NOT NULL, default `now()` | When the set was saved |

**Primary key:** composite `(UserId, SetId)` — each user can save a set only once.

**Indexes:**
- `IX_UserSets_SetId` — for looking up all users who saved a given set

**Cascade delete:**
- deleting `Users` → deletes all `UserSets` records for that user
- deleting `WordSets` → deletes all `UserSets` records for that set

---

### `SetProgress`

SRS (Spaced Repetition System) progress for a specific user on a specific set. Record is created on the user's first study session.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | `uuid` | PK | Unique record identifier |
| `UserId` | `uuid` | NOT NULL, FK → `Users.Id` | User |
| `SetId` | `uuid` | NOT NULL, FK → `WordSets.Id` | Set |
| `FirstStudiedAt` | `timestamptz` | NOT NULL | Date of first study session. Used as the reference point for SRS interval calculations |
| `LastStudiedAt` | `timestamptz` | NOT NULL | Date of most recent study session |
| `NextReviewAt` | `timestamptz` | nullable | Date of next scheduled review (stored as midnight UTC). `NULL` means either the cycle is complete (stage 4) or the cycle was reset (stage 0) |
| `ReviewStage` | `integer` | NOT NULL | Current SRS stage (see below) |
| `KnownCount` | `integer` | NOT NULL | Number of words marked "known" in the last session |
| `TotalWords` | `integer` | NOT NULL | Total number of words in the set at the time of the last session |

**Indexes:**
- `IX_SetProgress_UserId_SetId` — UNIQUE. One progress record per (user, set) pair
- `IX_SetProgress_UserId_NextReviewAt` — for fast lookup of sets due for review (Today page)
- `IX_SetProgress_SetId` — auxiliary

**Cascade delete:**
- deleting `Users` → deletes progress
- deleting `WordSets` → deletes progress

#### SRS Stages (`ReviewStage`)

| Stage | Meaning | `NextReviewAt` |
|---|---|---|
| `0` | Cycle reset (grace period expired) — must start over | `NULL` |
| `1` | First study session completed | `FirstStudiedAt + 1 day` |
| `2` | Day-1 review completed | `FirstStudiedAt + 7 days` |
| `3` | Day-7 review completed | `FirstStudiedAt + 14 days` |
| `4` | Cycle complete | `NULL` |

**Grace period:** if `NextReviewAt` is more than 3 days overdue, the cycle is automatically reset to stage 0 on the next study session.

**No double-advance:** stage advances only if `NextReviewAt.Date <= today`. Multiple sessions on the same day do not advance the stage more than once.

---

### `WordProgress`

Per-word statistics — how many times each word was marked "known" or "unknown". Used for the "weakest words" ranking in TestAll.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | `uuid` | PK | Unique record identifier |
| `UserId` | `uuid` | NOT NULL, FK → `Users.Id` | User |
| `WordId` | `uuid` | NOT NULL, FK → `Words.Id` | Word |
| `KnownCount` | `integer` | NOT NULL | Number of times the word was marked "known" |
| `UnknownCount` | `integer` | NOT NULL | Number of times the word was marked "unknown" |
| `LastSeenAt` | `timestamptz` | NOT NULL, default `now()` | Date last shown |

**Indexes:**
- `IX_WordProgress_UserId_WordId` — UNIQUE. One record per (user, word) pair
- `IX_WordProgress_WordId` — auxiliary

**Cascade delete:**
- deleting `Users` → deletes statistics
- deleting `Words` → deletes statistics

---

## Migrations

| File | What it does |
|---|---|
| `20260512122919_InitialCreate` | Creates all tables and indexes |
| `20260513092704_AddIsPublicIndex` | Adds index `IX_WordSets_IsPublic` |
| `20260513111010_AddGoogleAuth` | Removes `PasswordHash`, adds `GoogleId` and `AvatarUrl` to `Users` |
| `20260514000000_FixSetProgressDates` | Data migration: fixes corrupted `SetProgress` records (stage=0 with non-null date; time component in `NextReviewAt`) |
| `20260514134800_AddLanguageToWordSets` | Adds `Language` TEXT column to `WordSets`, default `'de-DE'` |

Migrations are applied automatically on API startup (`db.Database.Migrate()` in `Program.cs`).
