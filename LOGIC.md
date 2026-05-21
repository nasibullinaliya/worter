# Vocab App — Application Logic

## Stack
- **Backend**: ASP.NET Core 8, EF Core 8, PostgreSQL, Google.Apis.Auth
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Auth**: Google OAuth only (ID Token → backend JWT, 7 days)
- **Deploy**: Vercel (frontend) + Render (backend + PostgreSQL)

---

## Authentication

1. User clicks "Sign in with Google" → Google returns an `id_token`
2. Frontend sends `POST /api/auth/google { idToken }`
3. Backend validates the token via `GoogleJsonWebSignature.ValidateAsync` (checks Audience = ClientId)
4. Finds or creates a user by email
5. Returns a signed JWT (7-day expiry); frontend stores it in `localStorage`
6. On 401 → automatic redirect to `/login`

There is no password-based registration or login.

---

## Data Model Summary

| Table | Purpose |
|---|---|
| `Users` | Users (Google ID, email, name, avatar) |
| `WordSets` | Word sets (title, description, isPublic, language, OwnerId) |
| `Words` | Words (term, definition, example?, position, SetId) |
| `UserSets` | Saved sets from other users (UserId + SetId) |
| `SetProgress` | SRS progress per set (stage, NextReviewAt, FirstStudiedAt) |
| `WordProgress` | Per-word statistics (KnownCount, UnknownCount) |
| `DailyProgress` | Per-user per-day word count for the activity chart (composite PK: UserId + Date) |

The `Language` field on `WordSets` is a BCP-47 tag (default `de-DE`) used to drive browser TTS. Supported values: `de-DE`, `en-US`, `en-GB`, `fr-FR`, `es-ES`, `it-IT`.

The `Example` field on `Words` is an optional free-text usage example (nullable). Displayed in italic below the term in SetDetail, SetEdit, and on the front side of Flashcards (or back side when definition is the front).

---

## Sets (WordSets)

### Access
- **Owner** (`isOwner`): full access — view, edit, delete, study
- **Saved** (`UserSets`): view + study (no editing)
- **Public set**: any logged-in user can view and save it
- **Private foreign set**: inaccessible (403)

### Cloning (`POST /api/sets/{id}/clone`)
- Creates a record in `UserSets` — words are NOT physically copied
- After cloning, the user sees the set as "saved" and can study it
- Cannot clone your own set or one already saved

### Removing a saved set (`DELETE /api/sets/{id}/clone`)
- Removes the `UserSets` record; the original set is not affected

---

## Word Editing (SetEdit)

### Adding / editing words
- Each word has three fields: **term**, **definition**, **example** (optional)
- Words can be added one by one or via bulk import

### Swapping term ↔ definition
If the user accidentally imported words in the wrong order (e.g. translation in the term field), they can swap term and definition:

| Action | How | Endpoint |
|---|---|---|
| Swap a single word | ⇄ button next to that word | `PUT /api/words/{id}` with term/definition reversed |
| Swap all words in the set | "Swap all ⇄" button in section header | `POST /api/sets/{setId}/words/swap` |

`POST /api/sets/{setId}/words/swap` swaps `term ↔ definition` for every word in the set in a single DB round-trip and returns the updated `WordDto[]`. Only the set owner can call this endpoint.

---

## Word Import (SetNew / SetEdit)

Import accepts one word per line in the format `term{sep}translation` or `term[Tab]translation`.

### Parsing
- Default separator: `-`; user can change it; Tab always works regardless of separator setting
- Splits only on the **first** occurrence of the separator
- Lines without a valid separator are silently skipped

### Validation Warnings (non-blocking)
Displayed live as the user types, in an amber warning box. The import is **not blocked** — the user decides whether to proceed.

| Warning | Condition |
|---|---|
| **Duplicate** | Same term + same definition appears more than once in the import |
| **Conflict** | Same term appears with two or more different definitions in the import |
| **Already in other sets** | Imported term matches a term already present in another set owned/saved by the user |

For `SetEdit`, terms that already exist in the **current** set are excluded from the "already in other sets" check.

---

## SRS — Spaced Repetition

### Intervals (absolute days from `FirstStudiedAt`)

| Stage | Meaning | NextReviewAt |
|---|---|---|
| 0 | Reset / never studied | null |
| 1 | First study session completed | FirstStudiedAt + 1 day |
| 2 | Day-1 review completed | FirstStudiedAt + 2 days |
| 3 | Day-2 review completed | FirstStudiedAt + 4 days |
| 4 | Day-4 review completed | FirstStudiedAt + 7 days |
| 5 | Day-7 review completed | FirstStudiedAt + 14 days |
| 6 | Cycle complete | null (no longer appears in reminders) |

### Stage Advancement Rules
- **First session** (`SetProgress` does not exist yet) → `StartTracking`: stage=1, NextReviewAt = today+1
- **Repeat sessions** → `RecordReview`:
  - Stage advances **only if** `NextReviewAt.Date <= today`
  - Multiple sessions on the same day do not double-advance
  - NextReviewAt is calculated from `FirstStudiedAt`, not from the date of the last session

### Grace Period and Reset
- On every call to `POST /api/progress/{setId}`, overdue records are checked
- If `NextReviewAt + 3 days < today` → Reset: stage=0, NextReviewAt=null, KnownCount=0
- After reset the user must restart the cycle from scratch

### Dashboard Display (stage pips 1/2/4/7/14)
- Grey = future stage
- Bold dark = current (due now)
- Bold violet = completed stages

---

## Progress Recording

Every study method (Flashcards, Test, Quiz on a single set) calls `POST /api/progress/{setId}` with `{ wordResults: [{ wordId, errorCount }] }`.

| field | meaning |
|---|---|
| `errorCount = 0` | word answered correctly on the first try → counted as `KnownCount++` |
| `errorCount > 0` | word required one or more retries → counted as `UnknownCount += errorCount` |

This endpoint:
1. Updates per-word `WordProgress` records
2. Calls `StartTracking` / `RecordReview` / `Restart` on `SetProgress` → may advance the SRS stage
3. Calls `UpsertDailyProgress` → increments today's word count for the activity chart

---

## Flashcards Mode

**Route**: `/sets/:id/flashcards`

### Controls
- **Flip**: click card or press Space / ↑ / ↓
- **Known**: press → or click green button → word added to `known` set
- **Don't know**: press ← or click red button → word added to `unknown` set
- Cards are shuffled on every start/restart

### Front-side chooser
The user can pick which side of the card faces up:

| Setting | Front | Back |
|---|---|---|
| `term` (default) | Word + example | Translation |
| `definition` | Translation | Word + example |

The choice is persisted in `localStorage` (`fc_front_side`) and survives page reloads.

### Auto-play
- Toggleable button (persisted in `localStorage` as `fc_autoplay`)
- When on: speaks the front side text automatically on every card change (150 ms delay)
- Uses the set's `Language` for TTS when the term side is shown; `undefined` (browser default) for the definition side

### Session completion
- After the last card: `POST /api/progress/{setId}` with `errorCount=0` for known, `errorCount=1` for unknown
- Updates SRS, WordProgress, and DailyProgress

---

## Study Mode — TestRunner

**Routes**: `/sets/:id/test`, also used internally by TestAll (weakest-words mode)

### Stages
- Words are split into groups of 10 (STAGE_SIZE)
- Each group = one stage
- After each stage: a summary screen shows the stage's words (translation | term, ✓ for completed)

### Word Phases
1. **Choice** — pick from 4 options
   - Correct → moves to the Type phase (carried to next stage)
   - Incorrect → error counted, returned to the queue as Choice carry-over
2. **Type** — type the answer from memory
   - Correct → word is done (`doneIds`), green flash + 900 ms pause
   - Incorrect → error counted, returned to the queue as Type carry-over

The session ends only when **all words** pass both phases. By definition, `doneIds` contains every word at completion.

### Progress Recording
- On session complete: `POST /api/progress/{setId}` with actual `errorCount` per word
- Updates SRS (`SetProgress`) **and** per-word statistics (`WordProgress`) **and** `DailyProgress`

---

## Quiz Mode — QuizRunner

**Routes**: `/sets/:id/quiz` (single set), used internally by QuizAll

### Behavior
- All words displayed simultaneously as a table
- Two sub-modes: **type** (keyboard input) / **choice** (select from options)
- No stages, no carry-overs — each word appears exactly once
- "Study mistakes (N)" button → opens TestRunner with only the incorrect words (no SRS update for this sub-session)

### Progress Recording (single-set quiz)
- `POST /api/progress/{setId}` with `errorCount=0` for correct answers, `errorCount=1` for incorrect
- Updates SRS (`SetProgress`) **and** per-word statistics (`WordProgress`) **and** `DailyProgress`

### Results screen
- Green ✓ = correct
- Red strikethrough = user's wrong answer, correct answer shown below

---

## TestAll (`/test`)

- Loads all words from all user sets (`GET /api/sets/all-words`)
- User selects sets via checkboxes (all selected by default)
- User picks study mode: **All words** (shuffled) or **Weakest words** (ranked)

### Weakest Words Mode
- `GET /api/progress/weakest-words?setIds=&count=N` returns N words ranked:
  1. **Seen + weak**: KnownCount/(KnownCount+UnknownCount) < 1.0 — lowest rate first, then highest UnknownCount
  2. **Seen + mastered**: rate = 1.0
  3. **Never seen** (no WordProgress record) — always last
- Session runs TestRunner with those words (order preserved, not shuffled)
- **SRS is NOT updated** (multi-set session has no single setId)
- **WordProgress IS updated** via `POST /api/progress/words`

---

## QuizAll (`/quiz`)

- Loads all words from all user sets (`GET /api/sets/all-words`)
- Runs QuizRunner across all selected sets
- **SRS is NOT updated** (multi-set)
- **WordProgress IS updated** via `POST /api/progress/words`

---

## Today Page (`/today`)

- Shows sets where `NextReviewAt.Date <= today`
- Data comes from `GET /api/reminders`
- "Start test" button → `/sets/:id/test`
- After completing a test the set disappears on next page load (NextReviewAt moves to the future)
- Sets overdue by >3 days are reset (stage=0) on the next study session; they still appear on Today until studied

---

## Activity Chart (Dashboard sidebar)

### Weekly view (default)
- Shows 7 bars for Mon–Sun of the current calendar week
- `GET /api/progress/weekly`

### Monthly view (on demand)
- Shows 30 bars for the last 30 days including today
- `GET /api/progress/monthly`
- Loaded lazily on first click; cached in component state for the session

### Data storage
- `DailyProgress` table: composite PK (UserId, Date — `DateOnly`)
- Written by `UpsertDailyProgress` on every `POST /api/progress/{setId}` and `POST /api/progress/words`
- Row for a given date is **incremented** (not replaced) — studying the same set twice in one day accumulates counts

---

## Explore (Public Sets)

- `GET /api/explore?q=&page=` — search public sets from other users
- "+ Add to my sets" button → `POST /api/sets/{id}/clone` → creates a `UserSets` record
- Before cloning: view-only, study buttons hidden
- After cloning: Flashcards, Study, Quiz all available

---

## Text-to-Speech

TTS is handled entirely in the browser using the Web Speech API (`SpeechSynthesisUtterance`). The voice language is taken from the set's `Language` field. No backend TTS endpoint exists.

---

## Known Limitations

1. **SRS not updated by multi-set sessions** — TestAll and QuizAll update `WordProgress` only; SRS advancement requires a single-set study session (Flashcards, Test, or Quiz on a specific set)
2. **User name and avatar** are not refreshed if the user changes them in their Google account
