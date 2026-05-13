# План реализации — Vocab App

## Итерация 1 — Фундамент (3–4 дня)

### Backend
- [ ] Создать ASP.NET Core 8 Web API проект (`dotnet new webapi`)
- [ ] Подключить EF Core + Npgsql, настроить `AppDbContext`
- [ ] Описать модели: `User`, `WordSet`, `Word`, `UserSet`, `SetProgress`, `WordProgress`
- [ ] Первая миграция, применить к PostgreSQL
- [ ] Реализовать JWT-аутентификацию: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- [ ] Настроить Swagger (включая Bearer-авторизацию)

### Frontend
- [ ] Создать Vite + React + TypeScript проект
- [ ] Настроить React Router: маршруты `/login`, `/register`, `/dashboard`
- [ ] Реализовать страницы Login / Register с формами
- [ ] Хранение JWT в `localStorage`, axios-interceptor для подстановки заголовка
- [ ] Защищённый роут — редирект на `/login` если нет токена

### Инфраструктура
- [ ] `docker-compose.yml`: сервисы `postgres`, `api`, `web`
- [ ] `Dockerfile` для backend (multi-stage: sdk → aspnet)
- [ ] `Dockerfile` для frontend (node → nginx)
- [ ] `.env.example` с переменными окружения
- [ ] Проверить: `docker compose up --build` поднимает всё с нуля

---

## Итерация 2 — Наборы и слова (3–4 дня)

### Backend
- [ ] `SetsController`: GET /api/sets, POST, GET /{id}, PUT /{id}, DELETE /{id}
- [ ] Логика "мои наборы" = owned + saved через `UserSet`
- [ ] `WordsController`: POST /api/sets/{id}/words (одно слово и массив), PUT /words/{id}, DELETE /words/{id}
- [ ] Валидация: нельзя редактировать/удалять чужой набор
- [ ] `POST /api/sets/{id}/clone` — создаёт запись в `UserSet`

### Frontend
- [ ] Страница `/dashboard` — список своих наборов, карточки с кол-вом слов
- [ ] Страница `/sets/new` — форма создания набора + textarea для импорта
- [ ] Парсер импорта: `"term - definition"` и `"term\tdefinition"`
- [ ] Страница `/sets/:id` — список слов, кнопки "Карточки", "Тест", "Редактировать"
- [ ] Страница `/sets/:id/edit` — добавление/удаление/редактирование слов, переключатель публичный/приватный

---

## Итерация 3 — Учебные режимы (3–4 дня)

### Backend
- [ ] `POST /api/progress/{setId}` — принимает `{ knownWordIds: Guid[] }`, обновляет `WordProgress` и `SetProgress`
- [ ] `ReviewScheduler.StartTracking` — создаёт `SetProgress` при первом прохождении
- [ ] `ReviewScheduler.RecordReview` — обновляет `NextReviewAt` и `ReviewStage`
- [ ] `GET /api/progress/{setId}` — возвращает прогресс + статистику по словам

### Frontend
- [ ] Страница `/sets/:id/flashcards` — карточки с flip-анимацией, кнопки "Знаю" / "Не знаю"
- [ ] По завершении набора: вызов `POST /api/progress/{setId}`, экран с результатом
- [ ] Страница `/sets/:id/test` — 4 варианта ответа, счётчик правильных
- [ ] Страница `/test` — тест по всем наборам (объединённый пул слов)
- [ ] Компонент `ProgressBar` — процент знаемых слов в наборе

---

## Итерация 4 — Дашборд и напоминания (2–3 дня)

### Backend
- [ ] `GET /api/reminders` — `SetProgress` где `NextReviewAt <= DateTime.UtcNow` для текущего пользователя
- [ ] `GET /api/sets` дополнить полем прогресса (KnownCount / TotalWords, NextReviewAt)

### Frontend
- [ ] Компонент `ReviewBanner` — показывается вверху дашборда если есть наборы к повторению
- [ ] Бейдж с числом в навигации (тот же запрос `GET /api/reminders`)
- [ ] Дашборд: секция "К повторению сегодня" + секция "Все наборы" с прогрессом
- [ ] Индикатор стадии повторения (день 1 / 2 / 4 / 7 / 14) на карточке набора

---

## Итерация 5 — Публичные наборы (2–3 дня)

### Backend
- [ ] `GET /api/explore?q=&page=` — поиск по `Title` публичных наборов, пагинация
- [ ] Не показывать собственные наборы и уже сохранённые в `/explore`
- [ ] `POST /api/sets/{id}/clone` — идемпотентно (повторный вызов не создаёт дубль)

### Frontend
- [ ] Страница `/explore` — поиск с debounce, карточки наборов с кол-вом слов и именем автора
- [ ] Кнопка "Добавить в мои наборы" → вызов clone, обновление UI
- [ ] Страница `/sets/:id` для чужого набора — только просмотр и кнопка добавить, без редактирования

---

## Итерация 6 — Полировка (1–2 дня)

- [ ] Мобильная адаптация (responsive layout, удобный flip на touch)
- [ ] Обработка ошибок: toast-уведомления при сетевых ошибках
- [ ] Индексы в БД: `SetProgress(UserId, NextReviewAt)`, `WordProgress(UserId, WordId)`, `WordSet(IsPublic)`
- [ ] `docker-compose.prod.yml` — без volume-маунтов, `NODE_ENV=production`, `ASPNETCORE_ENVIRONMENT=Production`
- [ ] README с инструкцией запуска

---

## Итоговые сроки

| Итерация | Содержание | Дней |
|---------|-----------|------|
| 1 | Auth, Docker, базовый проект | 3–4 |
| 2 | Наборы, слова, импорт | 3–4 |
| 3 | Карточки, тест, прогресс | 3–4 |
| 4 | Дашборд, напоминания в UI | 2–3 |
| 5 | Публичные наборы | 2–3 |
| 6 | Полировка, прод-конфиг | 1–2 |
| **Итого** | | **~3 недели** |
