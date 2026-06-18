# Wörter — Vocabulary Learning App

A full-stack vocabulary learning application with spaced repetition (SRS). Create word sets, study with flashcards and quizzes, track progress, and follow a smart review schedule that adapts to your pace.

**Stack:** React 18 + TypeScript + Tailwind CSS · ASP.NET Core 8 · PostgreSQL · Google OAuth

---

## Features

- **Word sets** — create, edit, import (term–definition pairs), make public or keep private
- **Study modes** — flip-card flashcards, two-phase quiz (multiple choice → typed answer)
- **Spaced repetition** — 5-stage SRS with smart scheduling; grace period for missed days
- **Final stage** — stage 5 requires a perfect written test; tracks word-by-word completion
- **Weekly plan** — calendar view of upcoming reviews; drag-and-drop to reschedule
- **Activity charts** — daily word count for the current week and last 30 days
- **Explore** — search and save public sets created by other users
- **Dictionary** — search all words across all your sets; filter by completion status
- **Folders** — organize sets into custom folders; support for both owned and saved sets
- **Text-to-speech** — pronounce any word using the browser's Web Speech API
- **Multilingual UI** — Russian, English, and German interfaces
- **"Next set" button** — after finishing a session, jump directly to the next due set

---

## Quick Start (Docker)

```bash
git clone <repo-url>
cd vocab-app
docker compose up --build
```

| Service   | URL                           |
|-----------|-------------------------------|
| Frontend  | http://localhost:5173          |
| API       | http://localhost:5050          |
| Swagger   | http://localhost:5050/swagger  |
| Database  | localhost:5433 (postgres)      |

> Google OAuth requires a real Client ID — see [Configuration](#configuration).

---

## Project Structure

```
vocab-app/
├── backend/
│   ├── VocabApp.API/
│   │   ├── Controllers/     # 10 REST controllers
│   │   ├── Data/            # EF Core DbContext + 14 migrations
│   │   ├── DTOs/            # Request/response records
│   │   ├── Models/          # 9 entity classes
│   │   ├── Services/        # ReviewScheduler, AuthService, GeminiService
│   │   ├── Extensions/      # ClaimsPrincipal helpers
│   │   └── Program.cs
│   ├── VocabApp.Tests/      # 43 xUnit tests (SRS logic)
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/             # 9 Axios API modules
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # Auth, Lang (i18n), Toast
│   │   ├── pages/           # 14 route-level pages
│   │   ├── utils/           # SRS constants, quiz engine, speech, import parser
│   │   └── i18n/            # Translations (ru / en / de)
│   ├── Dockerfile           # Dev server
│   ├── Dockerfile.prod      # nginx production build
│   └── vercel.json
├── docker-compose.yml       # Local development
├── docker-compose.prod.yml  # Self-hosted production
└── .env.example
```

---

## Configuration

### Required environment variables

| Variable | Description |
|---|---|
| `ConnectionStrings__Default` | PostgreSQL connection string |
| `Jwt__Secret` | Signing key, ≥ 32 characters (`openssl rand -base64 32`) |
| `Jwt__Issuer` | Token issuer — any string, e.g. `worter-app` |
| `Jwt__ExpiresDays` | Token lifetime in days (default `7`) |
| `Frontend__Url` | Frontend origin for CORS (e.g. `https://yourapp.vercel.app`) |
| `Google__ClientId` | Google OAuth 2.0 Client ID |
| `Groq__ApiKey` | Groq API key for example-sentence generation (optional) |

Frontend (`.env.local`):

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL |
| `VITE_GOOGLE_CLIENT_ID` | Same Google Client ID as above |

See [.env.example](.env.example) for a full template.

---

## Deployment

### Vercel + Render + Neon (recommended free tier)

**1. Database — Neon**

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string (format: `Host=ep-xxx...;Database=vocab;Username=...;Password=...;SSL Mode=Require;Trust Server Certificate=true`)

**2. Backend — Render**

1. New → **Web Service** → connect your repository
2. Set **Root Directory** to `backend`, **Environment** to `Docker`
3. Add environment variables:

| Variable | Value |
|---|---|
| `ConnectionStrings__Default` | Neon connection string |
| `Jwt__Secret` | `openssl rand -base64 32` |
| `Jwt__Issuer` | `worter-app` |
| `Jwt__ExpiresDays` | `7` |
| `Frontend__Url` | Your Vercel URL (fill in after step 3) |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ASPNETCORE_URLS` | `http://+:8080` |
| `Google__ClientId` | Your Google Client ID |
| `Groq__ApiKey` | Your Groq key (optional) |

4. Deploy → copy the service URL (e.g. `https://worter-api.onrender.com`)

**3. Frontend — Vercel**

1. New Project → import your repository
2. Set **Root Directory** to `frontend`, **Framework** to Vite
3. Add environment variable `VITE_API_URL` = Render URL from step 2
4. Deploy

> After deploying the frontend, go back to Render and update `Frontend__Url` to your Vercel URL.

---

### Self-hosted (Docker Compose)

```bash
cp .env.example .env
# Edit .env with real values

docker compose -f docker-compose.prod.yml up -d --build
```

Frontend is served on port `80` via nginx, API on `8080`.

---

## Running Tests

**Backend (xUnit — 43 SRS tests):**

```bash
cd backend
dotnet test
```

**Frontend (Vitest):**

```bash
cd frontend
npm test
```

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for a full technical overview.

## Database Schema

See [DATABASE.md](DATABASE.md) for table definitions, relationships, and indexes.

---

## SRS Algorithm

The app uses a 5-stage spaced repetition system. Intervals are calculated relative to the **actual study date**, so a missed day shifts the schedule forward without breaking the sequence.

| Stage completed | Next review |
|---|---|
| 1 | +1 day |
| 2 | +1 day |
| 3 | +2 days |
| 4 | +3 days |
| 5 (Final) | Perfect score required |
| 6 | Complete — no more reviews |

**Grace period:** reviews missed by more than 3 days reset to stage 0 (final stage is exempt).

**Final stage:** the user must write all words correctly in a single session. Each correct word is marked individually; partial progress is saved between attempts.

Implementation: [`backend/VocabApp.API/Services/ReviewScheduler.cs`](backend/VocabApp.API/Services/ReviewScheduler.cs)
Tests: [`backend/VocabApp.Tests/ReviewSchedulerTests.cs`](backend/VocabApp.Tests/ReviewSchedulerTests.cs)
