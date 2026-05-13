# План деплоя — Wörter

## Стек

| Часть | Сервис | Tier |
|-------|--------|------|
| Фронтенд | Vercel | Free |
| Бэкенд | Render | Free |
| База данных | Neon | Free |

---

## Шаг 1 — GitHub

1. Создать репозиторий на [github.com/new](https://github.com/new) (без README и .gitignore)
2. Добавить SSH-ключ в [github.com/settings/keys](https://github.com/settings/keys) если не добавлен:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```
3. Запушить код:
   ```bash
   git remote add origin git@github.com:ВАШ_НИК/worter.git
   git branch -M main
   git push -u origin main
   ```

---

## Шаг 2 — База данных (Neon)

1. [neon.tech](https://neon.tech) → Sign up (через GitHub)
2. Create project → Name: `worter`, Region: EU Central
3. Скопировать строку подключения: Dashboard → **Connection string** → тип **ADO.NET**
4. К строке добавить `;Trust Server Certificate=true` в конец

Итоговый вид:
```
Host=ep-xxx.eu-central-1.aws.neon.tech;Database=neondb;Username=neondb_owner;Password=xxx;SSL Mode=VerifyFull;Trust Server Certificate=true
```

> Миграции применяются автоматически при старте API (`db.Database.Migrate()` в `Program.cs`)

---

## Шаг 3 — Бэкенд (Render)

1. [render.com](https://render.com) → Sign in with GitHub
2. **New +** → **Web Service** → подключить репо `worter`
3. Настройки:
   - **Root Directory:** `backend`
   - **Environment:** Docker
   - **Region:** Frankfurt (EU)
   - **Instance Type:** Free
4. Добавить переменные окружения:

| Key | Value |
|-----|-------|
| `ConnectionStrings__Default` | строка подключения от Neon |
| `Jwt__Secret` | случайная строка ≥ 32 символа: `openssl rand -base64 32` |
| `Jwt__Issuer` | `worter-app` |
| `Jwt__ExpiresDays` | `7` |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ASPNETCORE_URLS` | `http://+:8080` |
| `Frontend__Url` | URL Vercel-проекта (заполнить после шага 4) |

5. **Create Web Service** → дождаться деплоя (~5 мин)
6. Скопировать URL: `https://worter-api.onrender.com`

---

## Шаг 4 — Фронтенд (Vercel)

### Через CLI (рекомендуется)

```bash
cd frontend
npx vercel login        # войти через браузер
npx vercel --yes \
  -e VITE_API_URL=https://worter-api.onrender.com \
  --prod
```

### Через веб-интерфейс

1. [vercel.com](https://vercel.com) → Sign in with GitHub
2. **New Project** → импортировать репо `worter`
3. Настройки:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
4. Переменная окружения: `VITE_API_URL` = URL Render-бэкенда
5. **Deploy**

---

## Шаг 5 — Связать бэкенд с фронтендом

После деплоя фронта вернуться в Render → Environment → обновить:
```
Frontend__Url = https://worter.vercel.app   # точный URL из Vercel
```
→ **Manual Deploy** → редеплоить.

---

## Обновление после изменений в коде

```bash
git add -A
git commit -m "описание изменений"
git push origin main
```

- **Render** и **Vercel** автоматически подхватят push и передеплоят.

---

## Известные ограничения Free-tier

| Ограничение | Описание |
|-------------|----------|
| Render засыпает | Бэкенд засыпает после 15 мин простоя, первый запрос ждёт ~30 сек |
| Neon | 0.5 ГБ хранилища, 1 проект |
| Vercel | Лимит 100 ГБ трафика/мес |

---

## Self-hosted альтернатива (docker-compose.prod.yml)

```bash
cp .env.example .env
# заполнить .env

docker compose -f docker-compose.prod.yml up -d --build
```

Фронт на порту `80`, API на `8080`.
