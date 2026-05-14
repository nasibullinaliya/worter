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
| Frontend hosting | Vercel |
| Backend hosting | Render |
| Local dev DB | Docker Compose (postgres only) |

---

## Repository Structure

```
vocab-app/
├── docker-compose.yml          # local dev: postgres only
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
│       │   └── ExploreController.cs
│       ├── Data/
│       │   ├── AppDbContext.cs
│       │   └── Migrations/
│       ├── Models/
│       ├── DTOs/
│       ├── Program.cs
│       └── appsettings.json
└── frontend/
    └── src/
        ├── pages/
        │   ├── Dashboard.tsx
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
        └── api/
```

No `Services/` directory exists in the backend. Business logic lives directly in controllers.

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
| NextReviewAt | DateTime? | null = complete (stage 4) or reset (stage 0) |
| ReviewStage | int | 0..4 |
| KnownCount | int | words marked "known" in last session |
| TotalWords | int | total words in set at time of last session |

Unique: (UserId, SetId)

#### SRS Stages

| Stage | Meaning | NextReviewAt |
|---|---|---|
| 0 | Reset / never studied | null |
| 1 | First study done | FirstStudiedAt + 1 day |
| 2 | Day-1 review done | FirstStudiedAt + 7 days |
| 3 | Day-7 review done | FirstStudiedAt + 14 days |
| 4 | Cycle complete | null |

Grace period: if NextReviewAt is more than 3 days overdue → reset to stage 0 on next session.

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
```

### Words
```
POST   /api/sets/{id}/words       — bulk add words
PUT    /api/words/{id}            — update word
DELETE /api/words/{id}            — delete word
```

### Progress
```
POST /api/progress/{setId}                        — record study session (updates SRS + WordProgress)
POST /api/progress/words                          — record word-level known/unknown counts (WordProgress only, no SRS)
GET  /api/progress/weakest-words?setIds=&count=N  — get N weakest words ranked by WordProgress
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
- Stage 2 → +7 days
- Stage 3 → +14 days
- Stage 4 → null (done)

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

Docker Compose is used **only** for running a local PostgreSQL instance. The backend and frontend are run directly (not in Docker) in local development. Production deployments do not use Docker.

```yaml
# docker-compose.yml — local postgres only
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: vocab
      POSTGRES_USER: vocab
      POSTGRES_PASSWORD: vocab
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

Migrations are applied automatically on API startup (`db.Database.Migrate()` in `Program.cs`).
