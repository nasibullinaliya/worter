# Wörter

Приложение для изучения иностранных слов с карточками и тестами.  
Стек: React + Vite + TypeScript (фронт), ASP.NET Core 8 (бэк), PostgreSQL.

---

## Локальный запуск (Docker)

```bash
git clone <repo>
cd vocab-app
docker compose up --build
```

| Сервис   | URL                          |
|----------|------------------------------|
| Фронтенд | http://localhost:5173         |
| API      | http://localhost:5050         |
| Swagger  | http://localhost:5050/swagger |

---

## Деплой: Vercel + Render + Neon (бесплатно)

### 1. База данных — Neon

1. Зарегистрироваться на [neon.tech](https://neon.tech)
2. Создать проект → скопировать строку подключения вида:
   ```
   Host=ep-xxx.eu-central-1.aws.neon.tech;Database=vocab;Username=vocab;Password=xxx;SSL Mode=Require;Trust Server Certificate=true
   ```

---

### 2. Бэкенд — Render

1. Зарегистрироваться на [render.com](https://render.com)
2. New → **Web Service** → подключить репозиторий
3. Настройки:
   - **Root Directory:** `backend`
   - **Environment:** Docker
   - **Dockerfile Path:** `Dockerfile`
4. Добавить переменные окружения (Environment → Add Variable):

| Переменная | Значение |
|---|---|
| `ConnectionStrings__Default` | строка подключения от Neon |
| `Jwt__Secret` | случайная строка ≥ 32 символа (`openssl rand -base64 32`) |
| `Jwt__Issuer` | `worter-app` |
| `Jwt__ExpiresDays` | `7` |
| `Frontend__Url` | URL вашего Vercel-проекта (заполнить после шага 3) |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ASPNETCORE_URLS` | `http://+:8080` |
| `Groq__ApiKey` | API-ключ от [console.groq.com](https://console.groq.com) (для генерации текстов) |

5. Deploy → скопировать URL вида `https://worter-api.onrender.com`

---

### 3. Фронтенд — Vercel

1. Зарегистрироваться на [vercel.com](https://vercel.com)
2. New Project → импортировать репозиторий
3. Настройки:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Переменные окружения:

| Переменная | Значение |
|---|---|
| `VITE_API_URL` | URL Render-бэкенда из шага 2 |

5. Deploy

> После деплоя вернуться в Render и обновить `Frontend__Url` на URL Vercel-проекта.

---

## Самостоятельный хостинг (docker-compose.prod.yml)

```bash
cp .env.example .env
# Заполнить .env реальными значениями

docker compose -f docker-compose.prod.yml up -d --build
```

Фронт будет доступен на порту `80`, API на `8080`.

---

## Переменные окружения

Смотри [.env.example](.env.example).

---

## Алгоритм повторений (SRS)

Приложение использует систему интервального повторения с 6 стадиями.

### Интервалы

Интервалы отсчитываются **от фактической даты изучения** (не от даты первого изучения).  
Благодаря этому пропущенный день просто сдвигает расписание вперёд, не ломая последовательность стадий.

| Стадия завершена | Следующее повторение |
|---|---|
| 1 | через 1 день |
| 2 | через 1 день |
| 3 | через 2 дня |
| 4 | через 3 дня |
| 5 | через 7 дней |
| 6 | — (цикл завершён) |

**Пример без пропусков** (начало 23 мая):  
23 мая → 24 → 25 → 27 → 30 → 6 июня

**Пример с пропуском 2-й стадии** (изучил 25-го вместо 24-го):  
23 мая → 25 → 26 → 28 → 31 → 7 июня

### Период отсрочки (Grace Period)

Если повторение просрочено более чем на **3 дня**, прогресс сбрасывается и цикл начинается заново.

### Реализация

- `backend/VocabApp.API/Services/ReviewScheduler.cs` — логика расписания
- `backend/VocabApp.Tests/ReviewSchedulerTests.cs` — юнит-тесты (43 теста)

---

## Структура проекта

```
vocab-app/
├── backend/              # ASP.NET Core 8 API
│   ├── VocabApp.API/
│   │   ├── Controllers/
│   │   ├── Data/         # EF Core DbContext + миграции
│   │   ├── Models/
│   │   ├── Services/
│   │   └── Program.cs
│   └── Dockerfile
├── frontend/             # React + Vite
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   └── utils/
│   ├── Dockerfile        # dev (npm run dev)
│   ├── Dockerfile.prod   # prod (nginx)
│   ├── nginx.conf
│   └── vercel.json
├── docker-compose.yml      # локальная разработка
├── docker-compose.prod.yml # продакшн (self-hosted)
└── .env.example
```
