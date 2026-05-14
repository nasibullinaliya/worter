# Деплой продакшена

## Фронтенд — Vercel (через терминал)

```bash
cd /Users/aliianasibullina/vocab-app/frontend
vercel --prod
```

Занимает ~20 секунд. Сайт обновится на **https://frontend-ruby-delta-91.vercel.app**

---

## Бэкенд — Render (через браузер)

1. Открой [dashboard.render.com](https://dashboard.render.com)
2. Выбери сервис **api**
3. Кнопка **Manual Deploy** → **Deploy latest commit**
4. Дождись статуса **Live** (~2–5 минут)

---

## Полный цикл (после любых изменений в коде)

```bash
# 1. Закоммить и запушить
cd /Users/aliianasibullina/vocab-app
git add -A
git commit -m "описание изменений"
git push origin main

# 2. Задеплоить фронтенд
cd frontend
vercel --prod
```

Затем вручную передеплоить бэкенд на Render (если менялся).

---

## Когда что деплоить

| Что менялось | Фронтенд | Бэкенд |
|---|---|---|
| Только `.tsx` / `.ts` файлы | ✅ нужен | ❌ не нужен |
| Файлы в `backend/` | ❌ не нужен | ✅ нужен |
| Оба | ✅ нужен | ✅ нужен |
