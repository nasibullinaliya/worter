# Database Schema

PostgreSQL. ORM: Entity Framework Core 8. Все `DateTime` поля хранятся как `timestamp with time zone` (UTC).

---

## Диаграмма связей

```
Users
 ├── WordSets (OwnerId) — наборы, которые пользователь создал
 ├── UserSets (UserId) — чужие наборы, которые пользователь сохранил к себе
 ├── SetProgress (UserId) — прогресс SRS по наборам
 └── WordProgress (UserId) — статистика по отдельным словам

WordSets
 ├── Words (SetId) — слова набора
 ├── UserSets (SetId) — пользователи, сохранившие этот набор
 ├── SetProgress (SetId) — прогресс пользователей по этому набору
 └── Owner → Users

Words
 ├── Set → WordSets
 └── WordProgress (WordId) — статистика по этому слову
```

---

## Таблицы

### `Users`

Пользователи приложения. Авторизация только через Google OAuth.

| Колонка | Тип | Ограничения | Описание |
|---|---|---|---|
| `Id` | `uuid` | PK | Уникальный идентификатор пользователя |
| `Email` | `text` | NOT NULL, UNIQUE | Email из Google аккаунта |
| `GoogleId` | `text` | UNIQUE, nullable | `sub` из Google ID token. NULL — если пользователь ещё не входил через Google (устаревшие записи) |
| `Name` | `text` | nullable | Имя из Google профиля |
| `AvatarUrl` | `text` | nullable | URL аватара из Google профиля |
| `CreatedAt` | `timestamptz` | NOT NULL, default `now()` | Дата регистрации |

**Индексы:**
- `IX_Users_Email` — UNIQUE по `Email`
- `IX_Users_GoogleId` — UNIQUE по `GoogleId` (partial, только где `GoogleId IS NOT NULL`)

---

### `WordSets`

Наборы слов (учебные модули). Каждый набор принадлежит одному владельцу.

| Колонка | Тип | Ограничения | Описание |
|---|---|---|---|
| `Id` | `uuid` | PK | Уникальный идентификатор набора |
| `Title` | `text` | NOT NULL | Название набора (макс. 200 символов на уровне API) |
| `Description` | `text` | nullable | Описание набора (макс. 2000 символов на уровне API) |
| `IsPublic` | `boolean` | NOT NULL | Если `true` — набор виден всем в разделе «Explore» |
| `OwnerId` | `uuid` | NOT NULL, FK → `Users.Id` | Владелец набора |
| `CreatedAt` | `timestamptz` | NOT NULL, default `now()` | Дата создания |
| `UpdatedAt` | `timestamptz` | NOT NULL, default `now()` | Дата последнего изменения (обновляется вручную при PUT) |

**Индексы:**
- `IX_WordSets_OwnerId` — для быстрой выборки наборов пользователя
- `IX_WordSets_IsPublic` — для фильтрации публичных наборов в Explore

**Каскадное удаление:** при удалении `Users` → удаляются все `WordSets` владельца.

---

### `Words`

Слова внутри набора. Каждое слово принадлежит одному набору.

| Колонка | Тип | Ограничения | Описание |
|---|---|---|---|
| `Id` | `uuid` | PK | Уникальный идентификатор слова |
| `Term` | `text` | NOT NULL | Слово / термин (то, что учим) |
| `Definition` | `text` | NOT NULL | Перевод / определение |
| `Position` | `integer` | NOT NULL | Порядковый номер слова в наборе (0-based). Используется для сортировки |
| `SetId` | `uuid` | NOT NULL, FK → `WordSets.Id` | Набор, к которому относится слово |

**Индексы:**
- `IX_Words_SetId` — для быстрой выборки слов набора

**Каскадное удаление:** при удалении `WordSets` → удаляются все `Words` набора.

---

### `UserSets`

Связь «пользователь сохранил чужой набор к себе». Составной первичный ключ.

| Колонка | Тип | Ограничения | Описание |
|---|---|---|---|
| `UserId` | `uuid` | PK, FK → `Users.Id` | Пользователь, который сохранил набор |
| `SetId` | `uuid` | PK, FK → `WordSets.Id` | Сохранённый набор |
| `AddedAt` | `timestamptz` | NOT NULL, default `now()` | Дата добавления набора |

**Первичный ключ:** составной `(UserId, SetId)` — каждый пользователь может добавить набор только один раз.

**Индексы:**
- `IX_UserSets_SetId` — для выборки всех пользователей, сохранивших набор

**Каскадное удаление:**
- при удалении `Users` → удаляются все записи `UserSets` пользователя
- при удалении `WordSets` → удаляются все записи `UserSets` для этого набора

---

### `SetProgress`

Прогресс SRS (Spaced Repetition System) конкретного пользователя по конкретному набору. Запись создаётся при первом прохождении набора.

| Колонка | Тип | Ограничения | Описание |
|---|---|---|---|
| `Id` | `uuid` | PK | Уникальный идентификатор записи |
| `UserId` | `uuid` | NOT NULL, FK → `Users.Id` | Пользователь |
| `SetId` | `uuid` | NOT NULL, FK → `WordSets.Id` | Набор |
| `FirstStudiedAt` | `timestamptz` | NOT NULL | Дата первого прохождения набора. Используется как точка отсчёта для расписания SRS |
| `LastStudiedAt` | `timestamptz` | NOT NULL | Дата последнего прохождения |
| `NextReviewAt` | `timestamptz` | nullable | Дата следующего повторения (хранится как полночь UTC). `NULL` — либо цикл завершён (stage 4), либо цикл сброшен (stage 0) |
| `ReviewStage` | `integer` | NOT NULL | Текущая стадия SRS (см. ниже) |
| `KnownCount` | `integer` | NOT NULL | Количество слов, которые пользователь отметил как «знаю» в последней сессии |
| `TotalWords` | `integer` | NOT NULL | Общее количество слов в наборе на момент последней сессии |

**Индексы:**
- `IX_SetProgress_UserId_SetId` — UNIQUE. Одна запись прогресса на пару (пользователь, набор)
- `IX_SetProgress_UserId_NextReviewAt` — для быстрой выборки наборов к повторению (страница «Сегодня»)
- `IX_SetProgress_SetId` — вспомогательный

**Каскадное удаление:**
- при удалении `Users` → удаляется прогресс
- при удалении `WordSets` → удаляется прогресс

#### Стадии SRS (`ReviewStage`)

| Стадия | Значение | `NextReviewAt` |
|---|---|---|
| `0` | Цикл сброшен (grace period истёк). Нужно начать заново | `NULL` |
| `1` | Первое прохождение выполнено | `FirstStudiedAt + 1 день` |
| `2` | Повторение на день 1 выполнено | `FirstStudiedAt + 7 дней` |
| `3` | Повторение на день 7 выполнено | `FirstStudiedAt + 14 дней` |
| `4` | Цикл завершён | `NULL` |

**Grace period:** если `NextReviewAt` просрочена более чем на 3 дня — цикл автоматически сбрасывается в стадию 0 при следующем прохождении.

---

### `WordProgress`

Статистика по отдельным словам — сколько раз слово было отмечено как «знаю» / «не знаю». Используется в режиме Flashcards.

| Колонка | Тип | Ограничения | Описание |
|---|---|---|---|
| `Id` | `uuid` | PK | Уникальный идентификатор записи |
| `UserId` | `uuid` | NOT NULL, FK → `Users.Id` | Пользователь |
| `WordId` | `uuid` | NOT NULL, FK → `Words.Id` | Слово |
| `KnownCount` | `integer` | NOT NULL | Количество раз, когда слово отмечено как «знаю» |
| `UnknownCount` | `integer` | NOT NULL | Количество раз, когда слово отмечено как «не знаю» |
| `LastSeenAt` | `timestamptz` | NOT NULL, default `now()` | Дата последнего показа |

**Индексы:**
- `IX_WordProgress_UserId_WordId` — UNIQUE. Одна запись на пару (пользователь, слово)
- `IX_WordProgress_WordId` — вспомогательный

**Каскадное удаление:**
- при удалении `Users` → удаляется статистика
- при удалении `Words` → удаляется статистика

---

## Миграции

| Файл | Что делает |
|---|---|
| `20260512122919_InitialCreate` | Создаёт все таблицы и индексы |
| `20260513092704_AddIsPublicIndex` | Добавляет индекс `IX_WordSets_IsPublic` |
| `20260513111010_AddGoogleAuth` | Удаляет `PasswordHash`, добавляет `GoogleId` и `AvatarUrl` в `Users` |
| `20260514000000_FixSetProgressDates` | Data-миграция: исправляет битые записи `SetProgress` (stage=0 + NOT NULL дата; временна́я составляющая в `NextReviewAt`) |

Миграции применяются автоматически при старте API (`db.Database.Migrate()` в `Program.cs`).
