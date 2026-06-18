# Frontend — Wörter

React 18 + TypeScript + Vite + Tailwind CSS.

## Setup

```bash
npm install
```

Create `.env.local`:

```bash
VITE_API_URL=http://localhost:5050
VITE_GOOGLE_CLIENT_ID=<your Google OAuth client ID>
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server on :5173 |
| `npm run build` | TypeScript check + production bundle → `dist/` |
| `npm run preview` | Preview production build locally |
| `npm test` | Run Vitest test suite |
| `npm run lint` | ESLint |

## Structure

```
src/
├── api/            # Axios API modules (one file per resource)
│   ├── client.ts   # Base Axios instance with JWT interceptor
│   ├── auth.ts
│   ├── sets.ts
│   ├── words.ts
│   ├── progress.ts
│   ├── plan.ts
│   ├── folders.ts
│   ├── explore.ts
│   └── dictionary.ts
├── components/     # Reusable UI components
│   ├── Layout.tsx          # Top nav + page wrapper
│   ├── ProtectedRoute.tsx  # Auth guard
│   ├── TestRunner.tsx      # Two-phase quiz engine
│   ├── QuizRunner.tsx      # Written quiz runner
│   ├── NextSetButton.tsx   # Navigate to next set in plan
│   ├── ProgressBar.tsx
│   ├── ReviewBanner.tsx
│   └── SpeakButton.tsx     # Web Speech API TTS
├── context/
│   ├── AuthContext.tsx      # Current user + JWT
│   ├── LangContext.tsx      # i18n (ru / en / de)
│   └── ToastContext.tsx     # Toast notifications
├── i18n/
│   └── translations.ts     # All UI strings in 3 languages
├── pages/          # Route-level components (see ARCHITECTURE.md)
├── utils/
│   ├── srs.ts          # FINAL_STAGE, GRACE_PERIOD_DAYS constants
│   ├── testEngine.ts   # Quiz logic (checkAnswer, getChoices, hints, chunks)
│   ├── importParser.ts # Parse term-definition text input
│   └── speech.ts       # speechSynthesis wrapper
└── App.tsx         # Router + context providers
```

## Production Build (nginx)

The `Dockerfile.prod` builds the app with `npm run build` and serves it via nginx. See `nginx.conf` for the reverse-proxy configuration (routes `/api/` to the backend service).
