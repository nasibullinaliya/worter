# Архитектура — Vocab App

## Обзор

Веб-приложение для изучения слов по методу интервального повторения.
Бэкенд — ASP.NET Core 8, фронтенд — React + Vite, БД — PostgreSQL, всё запускается через Docker Compose.

---

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Backend | ASP.NET Core 8 Web API |
| ORM | Entity Framework Core 8 + Npgsql |
| БД | PostgreSQL 16 |
| Auth | ASP.NET Core Identity + JWT Bearer |
| Напоминания | UI-запрос при загрузке дашборда (без фонового сервиса) |
| Контейнеры | Docker Compose |

---

## Структура репозитория

```
vocab-app/
├── docker-compose.yml
├── .env.example
├── ARCHITECTURE.md
├── PLAN.md
├── backend/
│   ├── Dockerfile
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
│       ├── Services/
│       │   ├── AuthService.cs
│       │   ├── SetService.cs
│       │   ├── ProgressService.cs
│       │   └── ReviewScheduler.cs
│       ├── Program.cs
│       └── appsettings.json
└── frontend/
    ├── Dockerfile
    └── src/
        ├── pages/
        │   ├── Dashboard.tsx
        │   ├── SetDetail.tsx
        │   ├── SetEditor.tsx
        │   ├── Flashcards.tsx
        │   ├── Test.tsx
        │   └── Explore.tsx
        ├── components/
        │   ├── ReviewBanner.tsx
        │   ├── FlipCard.tsx
        │   └── ProgressBar.tsx
        └── api/
```

---

## Схема базы данных

### User
| Поле | Тип | Описание |
|------|-----|---------|
| Id | Guid | PK |
| Email | string | уникальный |
| PasswordHash | string | bcrypt |
| Name | string? | отображаемое имя |
| CreatedAt | DateTime | |

### WordSet
| Поле | Тип | Описание |
|------|-----|---------|
| Id | Guid | PK |
| Title | string | |
| Description | string? | |
| IsPublic | bool | виден в /explore |
| OwnerId | Guid | FK → User |
| CreatedAt | DateTime | |
| UpdatedAt | DateTime | |

### Word
| Поле | Тип | Описание |
|------|-----|---------|
| Id | Guid | PK |
| Term | string | слово |
| Definition | string | перевод / определение |
| Position | int | порядок в наборе |
| SetId | Guid | FK → WordSet |

### UserSet
Связь "пользователь добавил чужой публичный набор к себе".

| Поле | Тип |
|------|-----|
| UserId | Guid |
| SetId | Guid |
| AddedAt | DateTime |

PK: (UserId, SetId)

### SetProgress
Прогресс пользователя по набору + расписание интервального повторения.

| Поле | Тип | Описание |
|------|-----|---------|
| Id | Guid | PK |
| UserId | Guid | FK → User |
| SetId | Guid | FK → WordSet |
| FirstStudiedAt | DateTime | точка отсчёта интервалов |
| LastStudiedAt | DateTime | |
| NextReviewAt | DateTime? | null = курс завершён |
| ReviewStage | int | 0..4 (интервалы 1,2,4,7,14 дней) |
| KnownCount | int | слов отмечено «знаю» в последней сессии |
| TotalWords | int | всего слов в наборе на момент начала |

Unique: (UserId, SetId)

### WordProgress
| Поле | Тип | Описание |
|------|-----|---------|
| Id | Guid | PK |
| UserId | Guid | FK → User |
| WordId | Guid | FK → Word |
| KnownCount | int | сколько раз ответил верно |
| UnknownCount | int | сколько раз ошибся |
| LastSeenAt | DateTime | |

Unique: (UserId, WordId)

---

## API Endpoints

### Auth
```
POST /api/auth/register   — регистрация
POST /api/auth/login      — логин, возвращает JWT
GET  /api/auth/me         — текущий пользователь
```

### Наборы
```
GET    /api/sets              — мои наборы (owned + saved)
POST   /api/sets              — создать набор
GET    /api/sets/{id}         — набор со словами
PUT    /api/sets/{id}         — обновить заголовок, описание, видимость
DELETE /api/sets/{id}         — удалить (только свой)
POST   /api/sets/{id}/clone   — добавить чужой публичный набор к себе
```

### Слова
```
POST   /api/sets/{id}/words   — добавить слово или массив слов (импорт)
PUT    /api/words/{id}        — обновить слово
DELETE /api/words/{id}        — удалить слово
```

### Прогресс
```
POST /api/progress/{setId}    — записать результат сессии
GET  /api/progress/{setId}    — прогресс по конкретному набору
```

### Напоминания
```
GET /api/reminders            — наборы с next_review_at <= now() для текущего пользователя
```

### Публичные наборы
```
GET /api/explore?q=&page=     — поиск публичных наборов других пользователей
```

---

## Логика интервального повторения

Интервалы (дни от первого прохождения): `[1, 2, 4, 7, 14]`

```
При первом завершении набора:
  FirstStudiedAt = now
  ReviewStage    = 0
  NextReviewAt   = FirstStudiedAt + 1 день

После каждого повторения:
  ReviewStage++
  if ReviewStage < 5:
    NextReviewAt = FirstStudiedAt + Intervals[ReviewStage]
  else:
    NextReviewAt = null  // все стадии пройдены
```

Напоминание показывается в UI: при загрузке дашборда фронтенд вызывает `GET /api/reminders` и рендерит `ReviewBanner` со списком наборов к повторению.

---

## Режим тестирования

- Вопрос: показывается `Term`, нужно выбрать правильный `Definition`.
- Варианты: 1 правильный + 3 случайных из того же набора (или из всего пула при тесте по всем наборам).
- После теста: `WordProgress.KnownCount` / `UnknownCount` обновляются, вызывается `POST /api/progress/{setId}`.

---

## Импорт слов

Пользователь вставляет текст в формате:
```
apple - яблоко
banana - банан
```
или с табуляцией (совместимость с Quizlet):
```
apple	яблоко
banana	банан
```

Парсер (фронтенд): построчно → split по первому `-` или `\t` → массив `{term, definition}` → `POST /api/sets/{id}/words`.

---

## Docker Compose

```yaml
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

  api:
    build: ./backend
    depends_on:
      - postgres
    environment:
      ConnectionStrings__Default: Host=postgres;Database=vocab;Username=vocab;Password=vocab
      Jwt__Secret: changeme-32-chars-minimum-here!!
      Jwt__Issuer: vocab-app
      ASPNETCORE_ENVIRONMENT: Development
    ports:
      - "5000:8080"

  web:
    build: ./frontend
    depends_on:
      - api
    environment:
      VITE_API_URL: http://localhost:5000
    ports:
      - "5173:5173"

volumes:
  postgres_data:
```

### Запуск
```bash
docker compose up --build
docker compose exec api dotnet ef database update

# фронтенд: http://localhost:5173
# api:      http://localhost:5000
# swagger:  http://localhost:5000/swagger
```
