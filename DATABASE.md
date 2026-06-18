# Database Schema

PostgreSQL 16. ORM: Entity Framework Core 8. All `DateTime` values are stored as `timestamp with time zone` (UTC).

Migrations are EF-generated and applied automatically on startup. Migration files: `backend/VocabApp.API/Data/Migrations/`.

---

## Tables

### `Users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | `uuid` | PK | |
| `Email` | `text` | NOT NULL, UNIQUE | Used for login identity |
| `GoogleId` | `text` | nullable, UNIQUE | Google OAuth subject ID |
| `Name` | `text` | nullable | Display name from Google |
| `AvatarUrl` | `text` | nullable | Profile photo URL |
| `CreatedAt` | `timestamptz` | NOT NULL, default `now()` | |

---

### `WordSets`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | `uuid` | PK | |
| `Title` | `text` | NOT NULL | |
| `Description` | `text` | nullable | |
| `IsPublic` | `bool` | NOT NULL, default `false` | Visible in Explore when `true` |
| `Language` | `text` | NOT NULL, default `de-DE` | BCP-47 tag; used for TTS |
| `OwnerId` | `uuid` | FK → `Users.Id` ON DELETE CASCADE | |
| `FolderId` | `uuid` | FK → `Folders.Id` ON DELETE SET NULL, nullable | Owner's folder assignment |
| `CreatedAt` | `timestamptz` | NOT NULL, default `now()` | |
| `UpdatedAt` | `timestamptz` | NOT NULL, default `now()` | |

Index: `IsPublic` (for Explore queries)

---

### `Words`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | `uuid` | PK | |
| `Term` | `text` | NOT NULL | The word or phrase to learn |
| `Definition` | `text` | NOT NULL | Translation or explanation |
| `Example` | `text` | nullable | Usage example sentence |
| `Position` | `int` | NOT NULL | Display order within the set |
| `SetId` | `uuid` | FK → `WordSets.Id` ON DELETE CASCADE | |

---

### `UserSets`

Join table — records that a user has saved a public set created by someone else.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `UserId` | `uuid` | PK (composite), FK → `Users.Id` ON DELETE CASCADE | |
| `SetId` | `uuid` | PK (composite), FK → `WordSets.Id` ON DELETE CASCADE | |
| `AddedAt` | `timestamptz` | NOT NULL, default `now()` | |
| `FolderId` | `uuid` | FK → `Folders.Id` ON DELETE SET NULL, nullable | Per-user folder for this saved set |

---

### `SetProgress`

One row per (user, set) pair — the SRS state for that user's study of that set.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | `uuid` | PK | |
| `UserId` | `uuid` | FK → `Users.Id` ON DELETE CASCADE | |
| `SetId` | `uuid` | FK → `WordSets.Id` ON DELETE CASCADE | |
| `FirstStudiedAt` | `timestamptz` | NOT NULL | Timestamp of first session |
| `LastStudiedAt` | `timestamptz` | NOT NULL | Timestamp of most recent session |
| `NextReviewAt` | `timestamptz` | nullable | `null` = complete or reset |
| `ReviewStage` | `int` | NOT NULL | 0 = reset, 1–5 = active, 6 = complete |
| `KnownCount` | `int` | NOT NULL | Words answered correctly in last session |
| `TotalWords` | `int` | NOT NULL | Total words in the set at time of session |
| `FinalCompletedCount` | `int` | NOT NULL, default `0` | Words marked done in final stage (stage 5) |

Unique index: `(UserId, SetId)`  
Index: `(UserId, NextReviewAt)` — used by Plan and Reminders endpoints

---

### `WordProgress`

Per-word statistics for each user.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | `uuid` | PK | |
| `UserId` | `uuid` | FK → `Users.Id` ON DELETE CASCADE | |
| `WordId` | `uuid` | FK → `Words.Id` ON DELETE CASCADE | |
| `KnownCount` | `int` | NOT NULL, default `0` | Times answered correctly |
| `UnknownCount` | `int` | NOT NULL, default `0` | Total error count |
| `LastSeenAt` | `timestamptz` | NOT NULL | Last time this word was tested |
| `IsFinalCompleted` | `bool` | NOT NULL, default `false` | Passed the final-stage written test |

Unique index: `(UserId, WordId)`

---

### `DailyProgress`

Daily word count per user — powers activity bar charts.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `UserId` | `uuid` | PK (composite), FK → `Users.Id` ON DELETE CASCADE | |
| `Date` | `date` | PK (composite) | UTC calendar day |
| `WordCount` | `int` | NOT NULL | Total words studied that day |

---

### `SetStudyLogs`

Immutable audit log — one row appended per study session.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | `uuid` | PK | |
| `UserId` | `uuid` | FK → `Users.Id` ON DELETE CASCADE | |
| `SetId` | `uuid` | FK → `WordSets.Id` ON DELETE CASCADE | |
| `StudiedAt` | `timestamptz` | NOT NULL | Session timestamp |
| `StageBefore` | `int` | NOT NULL | `ReviewStage` before this session |
| `StageAfter` | `int` | NOT NULL | `ReviewStage` after this session |
| `NextReviewAtAfter` | `timestamptz` | nullable | `NextReviewAt` set after this session |
| `KnownCount` | `int` | NOT NULL | Words correct in this session |
| `TotalWords` | `int` | NOT NULL | Set size at session time |

Indexes: `(UserId, SetId)`, `(UserId, SetId, StudiedAt)`

---

### `Folders`

User-defined groups for organizing sets.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `Id` | `uuid` | PK | |
| `Name` | `text` | NOT NULL, max 100 chars | |
| `UserId` | `uuid` | FK → `Users.Id` ON DELETE CASCADE | |
| `CreatedAt` | `timestamptz` | NOT NULL, default `now()` | |

---

## Relationships Summary

```
User ──< WordSet           (owned sets, cascade delete)
User ──< UserSet           (saved sets, cascade delete)
User ──< SetProgress       (SRS state, cascade delete)
User ──< WordProgress      (word stats, cascade delete)
User ──< DailyProgress     (activity, cascade delete)
User ──< SetStudyLog       (audit, cascade delete)
User ──< Folder            (folders, cascade delete)

WordSet ──< Word           (words, cascade delete)
WordSet ──< UserSet        (who saved it, cascade delete)
WordSet ──< SetProgress    (progress records, cascade delete)
WordSet ──< SetStudyLog    (audit, cascade delete)
WordSet >── Folder         (optional; SET NULL on folder delete)

UserSet >── Folder         (optional; SET NULL on folder delete)

Word ──< WordProgress      (word stats, cascade delete)
```

---

## Migrations

| Name | What it does |
|---|---|
| `20260512122919_InitialCreate` | Initial schema: Users, WordSets, Words, UserSets, SetProgress, WordProgress, DailyProgress |
| `20260513092704_AddIsPublicIndex` | Index on `WordSets.IsPublic` |
| `20260513111010_AddGoogleAuth` | Add `GoogleId`, remove legacy `PasswordHash` from Users |
| `20260514000000_FixSetProgressDates` | Fix UTC handling for date columns |
| `20260514134800_AddLanguageToWordSets` | Add `Language` (BCP-47) to WordSets |
| `20260515173020_AddDailyProgress` | DailyProgress table |
| `20260519172836_AddExampleToWords` | Add nullable `Example` to Words |
| `20260522145336_AddSetStudyLog` | SetStudyLogs table |
| `20260522152516_FixStageOffsetAfterDay4Interval` | Fix off-by-one in stage 4 → 5 interval |
| `20260525085542_FixRelativeIntervalNextReviewAt` | NextReviewAt relative to LastStudiedAt, not FirstStudiedAt |
| `20260529144245_AddWordProgressFinalCompleted` | `IsFinalCompleted` on WordProgress |
| `20260529150137_AddSetProgressFinalCompletedCount` | `FinalCompletedCount` on SetProgress |
| `20260601130119_AddFolders` | Folders table + `FolderId` on WordSets (SET NULL) |
| `20260601135726_AddUserSetFolderId` | `FolderId` on UserSets (SET NULL) |
