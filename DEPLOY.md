# Deployment Guide

## Option 1 — Vercel + Render + Neon (recommended free tier)

### 1. Database — Neon

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string:
   ```
   Host=ep-xxx.eu-central-1.aws.neon.tech;Database=vocab;Username=vocab;Password=xxx;SSL Mode=Require;Trust Server Certificate=true
   ```

### 2. Backend — Render

1. **New → Web Service** → connect your repository
2. Set **Root Directory** to `backend`, **Environment** to `Docker`
3. Add environment variables:

| Variable | Value |
|---|---|
| `ConnectionStrings__Default` | Neon connection string |
| `Jwt__Secret` | `openssl rand -base64 32` (≥ 32 chars) |
| `Jwt__Issuer` | `worter-app` |
| `Jwt__ExpiresDays` | `7` |
| `Frontend__Url` | Your Vercel URL (fill in after step 3) |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ASPNETCORE_URLS` | `http://+:8080` |
| `Google__ClientId` | Your Google OAuth Client ID |
| `Groq__ApiKey` | Groq API key (optional — for example sentence generation) |

4. Deploy → note the service URL (e.g. `https://worter-api.onrender.com`)

### 3. Frontend — Vercel

1. **New Project** → import your repository
2. **Root Directory:** `frontend` · **Framework:** Vite · **Build Command:** `npm run build` · **Output Dir:** `dist`
3. Add environment variable: `VITE_API_URL` = Render URL from step 2
4. Deploy

> After the frontend is live, go back to Render and update `Frontend__Url` to your Vercel URL.

### 4. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add **Authorized JavaScript origins**: your Vercel URL + `http://localhost:5173`
4. Add **Authorized redirect URIs**: same origins
5. Copy the Client ID to both Render (`Google__ClientId`) and Vercel (`VITE_GOOGLE_CLIENT_ID`)

---

## Option 2 — Self-hosted (Docker Compose)

```bash
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, JWT_SECRET, FRONTEND_URL, API_URL, GOOGLE_CLIENT_ID

docker compose -f docker-compose.prod.yml up -d --build
```

Frontend on port `80`, API on `8080`.

Required `.env` variables:

```bash
POSTGRES_DB=vocab
POSTGRES_USER=vocab
POSTGRES_PASSWORD=<strong password>
JWT_SECRET=<openssl rand -base64 32>
FRONTEND_URL=https://your-domain.com
API_URL=https://your-domain.com/api   # or http://localhost:8080
GOOGLE_CLIENT_ID=<your client id>
```

---

## Local Development

```bash
docker compose up --build
```

| Service  | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API      | http://localhost:5050 |
| Swagger  | http://localhost:5050/swagger |
| Database | localhost:5433 |

The `./frontend/src` directory is mounted as a volume — Vite hot-reloads on file changes.

To rebuild after backend changes:

```bash
docker compose build api && docker compose up -d api
```

---

## EF Migrations

Migrations run automatically on API startup (`db.Database.Migrate()`).

To create a new migration during development:

```bash
cd backend
dotnet ef migrations add <MigrationName> --project VocabApp.API
```
