# Architecture

## Overview

Wörter is a monorepo with a React frontend, an ASP.NET Core 8 REST API, and a PostgreSQL database.

```
┌──────────────────────┐        HTTPS/JSON        ┌─────────────────────────────┐
│   React + Vite SPA   │  ──────────────────────►  │   ASP.NET Core 8 Web API    │
│   (Vercel / nginx)   │  ◄────────────────────── │   (Render / Docker)         │
└──────────────────────┘    JWT Bearer Token       └────────────┬────────────────┘
                                                                │  EF Core 8
                                                                ▼
                                                   ┌─────────────────────────────┐
                                                   │      PostgreSQL 16           │
                                                   │   (Neon / Docker)           │
                                                   └─────────────────────────────┘
```

---

## Backend — ASP.NET Core 8

### Controllers

| Controller | Base route | Responsibility |
|---|---|---|
| `AuthController` | `/api/auth` | Google ID token → JWT; current user info |
| `SetsController` | `/api/sets` | CRUD for word sets; clone/uncollect public sets |
| `WordsController` | `/api/sets/:id/words`, `/api/words/:id` | Add, update, delete words; swap term↔definition |
| `ProgressController` | `/api/progress` | Record sessions; word-level stats; activity charts |
| `PlanController` | `/api/plan` | Weekly/monthly review calendar; manual reschedule |
| `RemindersController` | `/api/reminders` | Sets due today (NextReviewAt ≤ today, not yet studied) |
| `FoldersController` | `/api/folders` | Create/rename/delete folders; assign sets |
| `ExploreController` | `/api/explore` | Paginated search of public sets |
| `DictionaryController` | `/api/dictionary` | Search all words across all user's sets |
| `TextGenController` | `/api/textgen` | Generate example sentences via Groq API |

### Authentication

```
Client                          Server
  │  POST /api/auth/google        │
  │  { idToken: "..." }           │
  │ ─────────────────────────────►│
  │                               │  GoogleJsonWebSignature.ValidateAsync(idToken)
  │                               │  → verify audience = Google__ClientId
  │                               │  → upsert User by email
  │                               │  → sign JWT (HS256, 7-day expiry)
  │  { token, user }              │
  │ ◄─────────────────────────────│
  │                               │
  │  GET /api/... (any endpoint)  │
  │  Authorization: Bearer <jwt>  │
  │ ─────────────────────────────►│
  │                               │  JwtBearerMiddleware validates token
  │                               │  ClaimsPrincipalExtensions.GetUserId()
```

JWT claims: `sub` = user Guid. All controllers extract the user ID from this claim.

### Access Control

Every endpoint that touches a set verifies access before operating:

| Scenario | Check |
|---|---|
| Read own set | `set.OwnerId == userId` |
| Read saved set | `UserSets` row exists for `(userId, setId)` |
| Read public set | `set.IsPublic == true` |
| Mutate set | `set.OwnerId == userId` only |
| Study any set | Owner **or** saved |
| Plan/Reminders | `OwnerId == userId OR UserSets.Any(...)` — excludes sets removed from collection with lingering `SetProgress` records |

### SRS — Spaced Repetition System

Core scheduling logic lives in `Services/ReviewScheduler.cs` (pure static class, fully unit-tested):

```
StartTracking()  — first session; creates SetProgress at stage 1
RecordReview()   — advances stage if due date has arrived; returns bool
IsExpired()      — true if overdue > GracePeriodDays AND stage < 5
Reset()          — stage → 0, NextReviewAt → null (grace period expired)
Restart()        — stage → 1, NextReviewAt → today+1 (first session after reset)
```

Stage advancement rules:
- Stages 1–4: reaching the scheduled day advances to the next stage unconditionally
- Stage 5 (Final): requires `knownCount == totalWords` (perfect score)
- Stage 6: complete, `NextReviewAt = null`

Interval calculation: `NextReviewAt = DateTime.UtcNow.Date + Intervals[newStage - 1]`

Intervals are relative to the **actual study date** — a missed day shifts future dates forward rather than causing the schedule to land on the same day again.

**Final stage word-by-word tracking:**
- Each correctly answered word sets `WordProgress.IsFinalCompleted = true`
- `SetProgress.FinalCompletedCount` is updated on every partial attempt
- When `FinalCompletedCount == TotalWords` the set auto-advances to stage 6

### Two-Phase Quiz (TestRunner)

Each word goes through two phases in the same session:

1. **Choice phase** — multiple choice (3 distractors + correct answer)
2. **Type phase** — user types the answer (hint available: first 1–3 chars + underscores)

A word is "done" only when both phases pass. Failed words are carried over into the next stage chunk. Words are processed in groups of 10 (`STAGE_SIZE`).

### Services

| Service | Role |
|---|---|
| `AuthService` | Google ID token validation + JWT signing |
| `ReviewScheduler` | SRS scheduling (pure static, no DB dependencies) |
| `GeminiService` | HTTP client for Groq API (example sentence generation) |

---

## Frontend — React 18 + TypeScript

### Pages

| Route | Component | Description |
|---|---|---|
| `/login` | `Login` | Google OAuth entry point |
| `/dashboard` | `Dashboard` | My sets; folder pills; activity charts |
| `/sets/new` | `SetNew` | Create set with bulk word import |
| `/sets/:id` | `SetDetail` | View set; progress; edit/delete |
| `/sets/:id/edit` | `SetEdit` | Edit words; swap term↔def; import |
| `/sets/:id/flashcards` | `Flashcards` | Flip-card study mode |
| `/sets/:id/study` | `Test` | Two-phase quiz on one set (uses `TestRunner`) |
| `/sets/:id/test` | `Quiz` | Written quiz on one set (uses `QuizRunner`) |
| `/study` | `TestAll` | Two-phase quiz across all sets |
| `/test` | `QuizAll` | Written quiz across all sets |
| `/today` | `Today` | Sets due for review today |
| `/explore` | `Explore` | Search public sets |
| `/plan` | `Plan` | Weekly drag-and-drop review calendar |
| `/dictionary` | `Dictionary` | Search all words |

### State Management

Three React contexts handle global state:

| Context | Stored in | Purpose |
|---|---|---|
| `AuthContext` | `localStorage` | Current user, JWT token, login/logout |
| `LangContext` | `localStorage` | UI language (ru / en / de), date locale |
| `ToastContext` | component state | Toast notifications (auto-dismiss) |

No external state library — all page-level state is local `useState` / `useEffect`.

### API Layer

`src/api/client.ts` creates an Axios instance with:
- Base URL from `VITE_API_URL`
- Request interceptor: attach `Authorization: Bearer <token>`
- Response interceptor: on 401 → logout + redirect; on 5xx → show toast

Each API module exports typed async functions returning data directly (`.then(r => r.data)`).

### Key Utils

**`testEngine.ts`**
- `checkAnswer(input, correct)` — normalizes whitespace/punctuation, case-insensitive
- `getChoices(word, allWords, dir)` — 4 shuffled options (3 wrong + 1 correct)
- `getHint(answer)` — first 1–3 characters + underscores for the rest
- `chunkWords(words, size)` — shuffle then split into stage groups
- `buildStageQueue(carryOvers, newWords)` — interleave carry-overs with new words

**`importParser.ts`**
- Parses `term - definition` or `term\tdefinition` lines
- Tab always works; user can configure a custom separator
- Splits on the **first** occurrence of the separator
- Warns about: duplicates, definition conflicts, words already in other sets

**`srs.ts`** — `FINAL_STAGE = 5`, `GRACE_PERIOD_DAYS = 3` (mirrors backend constants)

**`speech.ts`** — wraps `window.speechSynthesis`; uses the set's BCP-47 language tag

### i18n

`src/i18n/translations.ts` is a flat object keyed by language code (`ru`, `en`, `de`). `LangContext` provides `t(key)` and the current locale for `toLocaleDateString`. Language selection is stored in `localStorage`.

---

## Data Flow — Study Session

```
User finishes all words in TestRunner / QuizRunner
          │
          ▼
onFinish(wordResults[])
          │
          ▼
POST /api/progress/:setId
  ├─ upsert WordProgress  (KnownCount, UnknownCount, IsFinalCompleted)
  ├─ upsert SetProgress   (ReviewStage, NextReviewAt, FinalCompletedCount)
  ├─ append SetStudyLog   (audit trail: stage before/after, known/total)
  └─ upsert DailyProgress (activity chart counter)
  → returns SetProgressDto
          │
          ▼
GET /api/reminders  (after session is saved)
  → remaining due sets for today (current set now has LastStudiedAt = today)
          │
          ▼
NextSetButton shown on completion screen
  → user navigates to next set in plan
```

---

## Infrastructure

### Local development (`docker-compose.yml`)

Three services: `postgres` (health-checked), `api` (waits for postgres), `web` (mounts `./frontend/src` for hot reload).

| Port | Service |
|---|---|
| 5173 | Vite dev server |
| 5050 | ASP.NET Core API |
| 5433 | PostgreSQL |

### Production (`docker-compose.prod.yml`)

Same services plus nginx as a reverse proxy. Frontend served on port 80; API on 8080. Requires a `.env` file — see [.env.example](.env.example).

### EF Migrations

All 14 migrations are EF-generated (`dotnet ef migrations add`). Applied automatically on startup via `db.Database.Migrate()` in `Program.cs` — no manual SQL steps needed.
