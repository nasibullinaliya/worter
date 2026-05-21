# Architecture — Vocab App

## Overview

A web application for learning vocabulary using spaced repetition.
Backend: ASP.NET Core 8. Frontend: React + Vite. Database: PostgreSQL.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend | ASP.NET Core 8 Web API |
| ORM | Entity Framework Core 8 + Npgsql |
| Database | PostgreSQL (hosted on Render) |
| Auth | Google OAuth only — `@react-oauth/google` on the frontend, `GoogleJsonWebSignature` on the backend, JWT (7 days) |
| TTS | Browser Web Speech API (no backend involvement) |
| Drag & Drop | `@dnd-kit/core` + `@dnd-kit/utilities` (Plan page rescheduling) |
| Frontend hosting | Vercel |
| Backend hosting | Render |
| Local dev | Docker Compose (postgres + api + web) |

---

## Repository Structure

```
vocab-app/
├── docker-compose.yml          # local dev: postgres + api + web
├── .env.example
├── ARCHITECTURE.md
├── DATABASE.md
├── LOGIC.md
├── backend/
│   ├── VocabApp.sln
│   └── VocabApp.API/
│       ├── Controllers/
│       │   ├── AuthController.cs
│       │   ├── SetsController.cs
│       │   ├── WordsController.cs
│       │   ├── ProgressController.cs
│       │   ├── RemindersController.cs
│       │   ├── PlanController.cs
│       │   └── ExploreController.cs
│       ├── Data/
│       │   ├── AppDbContext.cs
│       │   └── Migrations/
│       ├── Models/
│       ├── DTOs/
│       │   └── PlanDtos.cs
│       ├── Services/
│       │   └── ReviewScheduler.cs
│       ├── Program.cs
│       └── appsettings.json
└── frontend/
    └── src/
        ├── pages/
        │   ├── Dashboard.tsx
        │   ├── Plan.tsx
        │   ├── SetDetail.tsx
        │   ├── SetNew.tsx
        │   ├── SetEdit.tsx
        │   ├── Flashcards.tsx
        │   ├── Test.tsx
        │   ├── TestAll.tsx
        │   ├── Quiz.tsx
        │   ├── QuizAll.tsx
        │   ├── Today.tsx
        │   ├── Explore.tsx
        │   └── Login.tsx
        ├── components/
        │   ├── Layout.tsx
        │   ├── ProgressBar.tsx
        │   ├── SpeakButton.tsx
        │   ├── TestRunner.tsx
        │   ├── QuizRunner.tsx
        │   ├── ReviewBanner.tsx
        │   └── StageProgress.tsx
        ├── api/
        │   ├── client.ts
        │   ├── plan.ts
        │   ├── progress.ts
        │   └── sets.ts
        └── test/
            └── pipClass.test.ts
```

Business logic for SRS scheduling lives in `Services/ReviewScheduler.cs`.

---

## Database Models

### User
| Field | Type | Description |
|---|---|---|
| Id | Guid | PK |
| Email | string | unique |
| GoogleId | string? | `sub` from Google ID token |
| Name | string? | display name |
| AvatarUrl | string? | Google profile photo URL |
| CreatedAt | DateTime | |

### WordSet
| Field | Type | Description |
|---|---|---|
| Id | Guid | PK |
| Title | string | |
| Description | string? | |
| IsPublic | bool | visible in Explore |
| Language | string | BCP-47 tag, default `de-DE`. Used for TTS. |
| OwnerId | Guid | FK → User |
| CreatedAt | DateTime | |
| UpdatedAt | DateTime | |

Supported `Language` values: `de-DE`, `en-US`, `en-GB`, `fr-FR`, `es-ES`, `it-IT`.

### Word
| Field | Type | Description |
|---|---|---|
| Id | Guid | PK |
| Term | string | the word being learned |
| Definition | string | translation / definition |
| Example | string? | optional usage example |
| Position | int | order within the set |
| SetId | Guid | FK → WordSet |

### UserSet
Join table: "user saved someone else's public set".

| Field | Type |
|---|---|
| UserId | Guid |
| SetId | Guid |
| AddedAt | DateTime |

PK: (UserId, SetId)

### SetProgress
User's SRS progress on a set.

| Field | Type | Description |
|---|---|---|
| Id | Guid | PK |
| UserId | Guid | FK → User |
| SetId | Guid | FK → WordSet |
| FirstStudiedAt | DateTime | interval reference point |
| LastStudiedAt | DateTime | |
| NextReviewAt | DateTime? | null = complete (stage 6) or not started (stage 0) |
| ReviewStage | int | 0..6 |
| KnownCount | int | words marked "known" in last session |
| TotalWords | int | total words in set at time of last session |

Unique: (UserId, SetId)

#### SRS Stages

| Stage | Meaning | NextReviewAt |
|---|---|---|
| 0 | Reset / never studied | null |
| 1 | After first study | FirstStudiedAt + 1 day |
| 2 | After day-1 review | FirstStudiedAt + 2 days |
| 3 | After day-2 review | FirstStudiedAt + 4 days |
| 4 | After day-4 review | FirstStudiedAt + 7 days |
| 5 | After day-7 review | FirstStudiedAt + 14 days |
| 6 | Cycle complete | null |

Grace period: if `NextReviewAt` is more than 3 days overdue → reset to stage 0 on next session.

### WordProgress
| Field | Type | Description |
|---|---|---|
| Id | Guid | PK |
| UserId | Guid | FK → User |
| WordId | Guid | FK → Word |
| KnownCount | int | times marked correct |
| UnknownCount | int | times marked incorrect |
| LastSeenAt | DateTime | |

Unique: (UserId, WordId)

### DailyProgress
Per-user per-day word count for the activity chart.

| Field | Type | Description |
|---|---|---|
| UserId | Guid | PK (composite) |
| Date | DateOnly | PK (composite) |
| WordCount | int | words studied on this date |

---

## API Endpoints

### Auth
```
POST /api/auth/google     — Google OAuth login/register (body: { idToken })
GET  /api/auth/me         — current user info
```

### Sets
```
GET    /api/sets                  — owned + saved sets with progress
POST   /api/sets                  — create set (title, description, isPublic, language)
GET    /api/sets/{id}             — set detail with words
PUT    /api/sets/{id}             — update set metadata
DELETE /api/sets/{id}             — delete own set
GET    /api/sets/all-words        — all words from all user's sets (used by TestAll)
POST   /api/sets/{id}/clone       — save public set to mine (creates UserSet record)
DELETE /api/sets/{id}/clone       — remove saved set from mine
POST   /api/sets/{id}/words/swap  — swap term ↔ definition for all words in a set
```

### Words
```
POST   /api/sets/{id}/words       — bulk add words
PUT    /api/words/{id}            — update word
DELETE /api/words/{id}            — delete word
```

### Progress
```
POST /api/progress/{setId}                        — record study session (updates SRS + WordProgress + DailyProgress)
POST /api/progress/words                          — record word-level results (WordProgress + DailyProgress only, no SRS)
GET  /api/progress/weekly                         — word counts for Mon–Sun of the current week
GET  /api/progress/monthly                        — word counts for the last 30 days
GET  /api/progress/weakest-words?setIds=&count=N  — get N weakest words ranked by WordProgress
```

### Plan
```
GET   /api/plan/weekly?from=YYYY-MM-DD  — Mon–Sun of the week containing `from` (defaults to current week)
                                          Includes overdue sets (within 3-day grace period) on today's date
PATCH /api/plan/{setId}/reschedule      — move NextReviewAt to a new date (body: { date: "YYYY-MM-DD" })
                                          Only for stages 1–5; target date must be >= today
```

### Reminders
```
GET /api/reminders                — sets with NextReviewAt <= today for the current user
```

### Explore
```
GET /api/explore?q=&page=         — search public sets
```

---

## Authentication Flow

1. User clicks "Sign in with Google" → `@react-oauth/google` returns an `id_token`
2. Frontend sends `POST /api/auth/google { idToken }`
3. Backend validates the token via `GoogleJsonWebSignature.ValidateAsync` (checks Audience = ClientId)
4. Finds or creates a user by email
5. Returns a signed JWT (7-day expiry); frontend stores it in `localStorage`
6. All subsequent API requests send the JWT as `Authorization: Bearer <token>`
7. On 401 → automatic redirect to `/login`

There is no password-based registration or login.

---

## Text-to-Speech

TTS is handled entirely in the browser using the Web Speech API (`SpeechSynthesisUtterance`). The `Language` field of the `WordSet` is passed as the voice language. No backend involvement.

---

## SRS Logic

Intervals from `FirstStudiedAt`:
- Stage 1 → +1 day
- Stage 2 → +2 days
- Stage 3 → +4 days
- Stage 4 → +7 days
- Stage 5 → +14 days
- Stage 6 → null (complete)

Stage advances only if `NextReviewAt.Date <= today`. Multiple sessions on the same day do not double-advance. Grace period: >3 days overdue → reset to stage 0.

---

## Word Import

The user pastes text in the format:
```
apple - яблоко
banana - банан
```
or tab-separated (Quizlet-compatible):
```
apple	яблоко
banana	банан
```

Frontend parser: line-by-line → split on first `-` or `\t` → array of `{term, definition}` → `POST /api/sets/{id}/words`.

---

## Local Development

Docker Compose runs the full stack locally: PostgreSQL, .NET API, and the Vite frontend.

```
docker compose up --build -d
```

- Frontend: http://localhost:5173
- API: http://localhost:8080

Migrations are applied automatically on API startup (`db.Database.Migrate()` in `Program.cs`).
