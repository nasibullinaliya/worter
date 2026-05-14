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
| `Words` | Words (term, definition, position, SetId) |
| `UserSets` | Saved sets from other users (UserId + SetId) |
| `SetProgress` | SRS progress per set (stage, NextReviewAt, FirstStudiedAt) |
| `WordProgress` | Per-word statistics (known/unknown count) |

The `Language` field on `WordSets` is a BCP-47 tag (default `de-DE`) used to drive browser TTS. Supported values: `de-DE`, `en-US`, `en-GB`, `fr-FR`, `es-ES`, `it-IT`.

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

## SRS — Spaced Repetition

### Intervals (from `FirstStudiedAt`)

| Stage | Meaning | NextReviewAt |
|---|---|---|
| 0 | Reset / never studied | null |
| 1 | First study session completed | FirstStudiedAt + 1 day |
| 2 | Day-1 review completed | FirstStudiedAt + 7 days |
| 3 | Day-7 review completed | FirstStudiedAt + 14 days |
| 4 | Cycle complete | null (no longer appears) |

### Stage Advancement Rules
- **First session** (`SetProgress` does not exist yet) → `StartTracking`: stage=1, NextReviewAt = today+1
- **Repeat sessions** → `RecordReview`:
  - Stage advances ONLY if `NextReviewAt.Date <= today`
  - Multiple sessions on the same day do not double-advance
  - NextReviewAt is calculated from `FirstStudiedAt`, not from the date of the last session

### Grace Period and Reset
- On every call to `POST /api/progress/{setId}`, overdue records are checked
- If `NextReviewAt + 3 days < today` → Reset: stage=0, NextReviewAt=null, KnownCount=0
- After reset the user must restart the cycle from scratch

### Dashboard Display (stage pips 1/7/14)
- Grey = future stage
- Bold dark = current (due now)
- Bold green = completed

---

## Study Mode — TestRunner

**Routes**: `/sets/:id/test`, and used internally by TestAll weakest-words mode

### Stages
- Words are split into groups of 10 (STAGE_SIZE)
- Each group = one stage
- After each stage: a summary screen shows the stage's words (translation | term, ✓ for completed)

### Word Phases
1. **Choice** — pick from 4 options
   - Correct → moves to the Type phase in the next stage
   - Incorrect → returned to the queue as a carry-over (Choice)
2. **Type** — type the answer from memory
   - Correct → word is done (`doneIds`)
   - Incorrect → returned to the queue as a carry-over (Type)

### Progress Recording
- On completion of all stages: `POST /api/progress/{setId}` with `knownWordIds` = words in `doneIds`
- Updates SRS (`SetProgress`) **and** per-word statistics (`WordProgress`)

---

## Quiz Mode — QuizRunner

**Routes**: `/sets/:id/quiz` (single set), used internally by QuizAll

### Behavior
- All words displayed simultaneously as a table
- Two sub-modes: **type** (keyboard input) / **choice** (select from options)
- No stages, no carry-overs
- **SRS is NOT updated** — quiz does not affect the repetition schedule
- **WordProgress IS updated** via `POST /api/progress/words`

### Results
- Green ✓ = correct
- Red strikethrough = user's wrong answer, correct answer shown below
- "Study errors (N)" button → opens TestRunner with only the incorrect words

---

## TestAll (`/test`)

- Loads all words from all user sets (`GET /api/sets/all-words`)
- User selects sets via checkboxes (all selected by default)
- User picks a word count N for "weakest words" mode

### Weakest Words Mode
- `GET /api/progress/weakest-words?setIds=&count=N` returns N words ranked by weakness:
  1. Words with no `WordProgress` record come first
  2. Then by lowest known/(known+unknown) ratio
  3. Then by highest unknown count as a tiebreaker
- Session runs TestRunner with those words
- **SRS is NOT updated**
- **WordProgress IS updated** via `POST /api/progress/words`

---

## QuizAll (`/quiz`)

- Loads all words from all user sets (`GET /api/sets/all-words`)
- Runs QuizRunner across all selected sets
- **SRS is NOT updated**
- **WordProgress is NOT updated** — QuizAll records nothing

---

## Today Page (`/today`)

- Shows sets where `NextReviewAt.Date <= today`
- Data comes from `GET /api/reminders`
- "Start test" button → `/sets/:id/test`
- After completing a test the set disappears on next page load (NextReviewAt moves to the future)
- Sets overdue by >3 days are reset (stage=0) on the next study session; they still appear on Today until studied

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

1. **SRS is only updated by TestRunner** — completing a set via TestRunner (single-set or weakest-words) is the only way to advance the SRS stage
2. **QuizRunner** updates `WordProgress` but does NOT update SRS
3. **TestAll** updates `WordProgress` but does NOT update SRS
4. **QuizAll** updates nothing — purely a free-practice mode
5. **User name and avatar** are not refreshed if the user changes them in their Google account
