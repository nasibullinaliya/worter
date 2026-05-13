# План миграции на Google OAuth

## Анализ текущей системы

### Бэкенд
| Компонент | Текущая реализация |
|-----------|-------------------|
| `AuthService.cs` | BCrypt-хэш пароля, генерация JWT (HS256, 7 дней) |
| `AuthController.cs` | POST `/api/auth/register`, POST `/api/auth/login`, GET `/api/auth/me` |
| `Program.cs` | `AddAuthentication(JwtBearerDefaults)` + валидация по `Jwt:Secret` / `Jwt:Issuer` |
| `User` (модель) | `Id`, `Email`, `PasswordHash`, `Name`, `CreatedAt` |
| `AuthDtos.cs` | `RegisterRequest(Email, Password, Name?)`, `LoginRequest(Email, Password)` |

### Фронтенд
| Компонент | Текущая реализация |
|-----------|-------------------|
| `AuthContext.tsx` | `login(email, password)`, `register(email, password, name?)`, `logout()` |
| `api/auth.ts` | axios-вызовы `/api/auth/login` и `/api/auth/register` |
| `Login.tsx` / `Register.tsx` | Формы email + password |
| Хранение токена | `localStorage.setItem('token', token)` |

### Что нужно убрать
- Поле `PasswordHash` в `User`
- `RegisterRequest`, `LoginRequest` с паролем
- Страницы `Login.tsx`, `Register.tsx` (формы)
- `BCrypt.Net.BCrypt` пакет

---

## Выбранный подход: Frontend-Initiated OAuth (рекомендуемый для SPA + API)

```
Браузер → Google (OAuth consent screen)
         ↓ id_token (JWT от Google)
Браузер → POST /api/auth/google { idToken }
         ↓ Бэкенд валидирует через Google публичные ключи
         ↓ Находит или создаёт User по email
         ↓ Возвращает собственный JWT (как раньше)
Браузер → Все запросы с Authorization: Bearer <наш JWT>
```

Преимущества:
- Бэкенд остаётся stateless (JWT как раньше)
- Не нужен OAuth callback URL на бэкенде
- Минимальные изменения в остальной части приложения

---

## Пошаговый план реализации

### Шаг 0. Google Cloud Console
1. Открыть https://console.cloud.google.com/apis/credentials
2. Создать проект (или выбрать существующий)
3. **OAuth consent screen** → External → заполнить название, email
4. **Credentials** → Create credentials → OAuth 2.0 Client ID
   - Application type: **Web application**
   - Authorised JavaScript origins:
     - `http://localhost:5173` (dev)
     - `https://frontend-ruby-delta-91.vercel.app` (prod)
   - Authorised redirect URIs: не нужны (используем Implicit / PKCE flow)
5. Скопировать **Client ID** (вида `123456789-abc.apps.googleusercontent.com`)

> Client Secret на фронтенд **не передаётся** — только Client ID.

---

### Шаг 1. Бэкенд — модель и миграция

**`Models/User.cs`** — убрать `PasswordHash`, добавить `GoogleId`:
```csharp
public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = null!;
    public string? GoogleId { get; set; }   // ← новое
    public string? Name { get; set; }
    public string? AvatarUrl { get; set; }  // ← новое (фото из Google)
    public DateTime CreatedAt { get; set; }

    public ICollection<WordSet> OwnedSets { get; set; } = [];
    public ICollection<UserSet> SavedSets { get; set; } = [];
    public ICollection<SetProgress> Progress { get; set; } = [];
    public ICollection<WordProgress> WordProgress { get; set; } = [];
}
```

**`Data/AppDbContext.cs`** — добавить индекс:
```csharp
entity.HasIndex(u => u.GoogleId).IsUnique().HasFilter("\"GoogleId\" IS NOT NULL");
```

**Миграция:**
```bash
cd backend/VocabApp.API
dotnet ef migrations add AddGoogleAuth
dotnet ef database update
```

---

### Шаг 2. Бэкенд — NuGet пакет

```bash
dotnet add package Google.Apis.Auth
```

Этот пакет умеет валидировать Google ID Token через публичные ключи Google (без сетевых запросов кроме первого кэширования ключей).

---

### Шаг 3. Бэкенд — DTOs

**`DTOs/AuthDtos.cs`** — добавить, старые можно удалить или оставить:
```csharp
public record GoogleAuthRequest(
    [Required] string IdToken
);

// AuthResponse и UserDto остаются без изменений
```

---

### Шаг 4. Бэкенд — AuthService

Заменить `RegisterAsync` / `LoginAsync` на `GoogleLoginAsync`:

```csharp
using Google.Apis.Auth;

public async Task<AuthResponse> GoogleLoginAsync(string idToken)
{
    // 1. Валидация токена через Google
    var payload = await GoogleJsonWebSignature.ValidateAsync(idToken,
        new GoogleJsonWebSignature.ValidationSettings
        {
            Audience = new[] { _config["Google:ClientId"] }
        });
    // Бросает InvalidJwtException если токен невалиден

    // 2. Найти или создать пользователя
    var user = await _db.Users
        .FirstOrDefaultAsync(u => u.Email == payload.Email);

    if (user == null)
    {
        user = new User
        {
            Id = Guid.NewGuid(),
            Email = payload.Email,
            GoogleId = payload.Subject,
            Name = payload.Name,
            AvatarUrl = payload.Picture,
            CreatedAt = DateTime.UtcNow
        };
        _db.Users.Add(user);
    }
    else
    {
        // Обновить данные профиля если изменились
        user.GoogleId ??= payload.Subject;
        user.Name ??= payload.Name;
        user.AvatarUrl ??= payload.Picture;
    }

    await _db.SaveChangesAsync();
    return new AuthResponse(GenerateToken(user), ToDto(user));
}
```

---

### Шаг 5. Бэкенд — AuthController

Заменить `/register` и `/login` на `/google`:

```csharp
[HttpPost("google")]
public async Task<IActionResult> Google([FromBody] GoogleAuthRequest req)
{
    try
    {
        var result = await authService.GoogleLoginAsync(req.IdToken);
        return Ok(result);
    }
    catch (InvalidJwtException)
    {
        return Unauthorized(new { message = "Invalid Google token." });
    }
}

// GET /api/auth/me — без изменений
```

---

### Шаг 6. Бэкенд — appsettings / переменные среды

**`appsettings.json`:**
```json
{
  "Google": {
    "ClientId": ""
  }
}
```

**Render environment variables:**
```
Google__ClientId = 123456789-abc.apps.googleusercontent.com
```

---

### Шаг 7. Фронтенд — установка библиотеки

```bash
npm install @react-oauth/google
```

Лёгкая официальная обёртка над Google Identity Services (GSI).

---

### Шаг 8. Фронтенд — `api/auth.ts`

Заменить `login` / `register` на `googleLogin`:

```ts
export const googleLogin = (idToken: string) =>
  client.post<AuthResponse>('/api/auth/google', { idToken }).then(r => r.data)
```

---

### Шаг 9. Фронтенд — `AuthContext.tsx`

```tsx
import { googleLogin as apiGoogleLogin } from '../api/auth'

interface AuthContextValue {
  user: UserDto | null
  isLoading: boolean
  loginWithGoogle: (idToken: string) => Promise<void>
  logout: () => void
}

// Убрать login() и register(), добавить:
const loginWithGoogle = async (idToken: string) => {
  const { token, user } = await apiGoogleLogin(idToken)
  localStorage.setItem('token', token)
  setUser(user)
}
```

---

### Шаг 10. Фронтенд — `main.tsx`

Обернуть приложение в провайдер Google:

```tsx
import { GoogleOAuthProvider } from '@react-oauth/google'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <LangProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </LangProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
)
```

---

### Шаг 11. Фронтенд — страница входа

Заменить формы `Login.tsx` и `Register.tsx` на единую страницу с кнопкой Google:

```tsx
import { useGoogleLogin } from '@react-oauth/google'

// Вариант A — готовая кнопка (проще)
import { GoogleLogin } from '@react-oauth/google'

<GoogleLogin
  onSuccess={(cred) => loginWithGoogle(cred.credential!)}
  onError={() => setError('Google sign-in failed')}
  theme="outline"
  size="large"
  width="100%"
  text="continue_with"
/>
```

Страница `Register.tsx` больше не нужна — Google сам создаёт аккаунт при первом входе.

---

### Шаг 12. Фронтенд — `.env` файлы

**`.env.local`** (dev):
```
VITE_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
```

**Vercel** — добавить переменную:
```bash
echo "123456789-abc.apps.googleusercontent.com" | vercel env add VITE_GOOGLE_CLIENT_ID production
vercel --prod
```

---

### Шаг 13. Маршрутизация

**`App.tsx`** — убрать маршрут `/register`, `/login` заменить на единый:
```tsx
<Route path="/login" element={<Login />} />
// <Route path="/register" element={<Register />} />  ← удалить
```

---

## Затронутые файлы

### Бэкенд
| Файл | Действие |
|------|----------|
| `Models/User.cs` | Удалить `PasswordHash`, добавить `GoogleId`, `AvatarUrl` |
| `DTOs/AuthDtos.cs` | Добавить `GoogleAuthRequest`, удалить `RegisterRequest`/`LoginRequest` |
| `Services/AuthService.cs` | Заменить логику, удалить BCrypt |
| `Controllers/AuthController.cs` | Заменить `/register` и `/login` на `/google` |
| `Data/AppDbContext.cs` | Индекс на `GoogleId` |
| `appsettings.json` | Секция `Google:ClientId` |
| `VocabApp.API.csproj` | Добавить `Google.Apis.Auth`, удалить `BCrypt.Net.BCrypt` |
| Новая миграция | `AddGoogleAuth` |

### Фронтенд
| Файл | Действие |
|------|----------|
| `main.tsx` | Обернуть в `<GoogleOAuthProvider>` |
| `api/auth.ts` | Заменить `login`/`register` на `googleLogin` |
| `context/AuthContext.tsx` | Заменить на `loginWithGoogle` |
| `pages/Login.tsx` | Полностью переписать — только кнопка Google |
| `pages/Register.tsx` | Удалить |
| `App.tsx` | Убрать маршрут `/register` |
| `package.json` | Добавить `@react-oauth/google` |
| `.env.local` | `VITE_GOOGLE_CLIENT_ID` |

---

## Что остаётся без изменений

- JWT-инфраструктура в `Program.cs` (бэкенд по-прежнему выдаёт свои токены)
- `GET /api/auth/me` и все остальные контроллеры
- `ProtectedRoute.tsx`, `AuthContext` в части хранения токена в localStorage
- `ClaimsPrincipalExtensions`, `GenerateToken` в AuthService
- Вся бизнес-логика наборов, прогресса, напоминаний

---

## Оценка трудозатрат

| Этап | Время |
|------|-------|
| Google Cloud Console (шаг 0) | 10 мин |
| Бэкенд (шаги 1–6) | 1–1.5 ч |
| Фронтенд (шаги 7–13) | 1 ч |
| Тестирование + деплой | 30 мин |
| **Итого** | **~3 часа** |
