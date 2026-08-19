# Конструктор школьного расписания

Веб-платформа для завучей двух общеобразовательных школ Казахстана: учебный год, две смены, импорт из Excel, ручная сетка и генерация черновика без конфликтов.

Интерфейс на русском языке. Деплой рассчитан на **Vercel + Supabase (PostgreSQL)**.

## Что умеет MVP

- Вход по email/паролю (Supabase Auth), роли `super_admin`, `school_admin`, `viewer`.
- Изоляция данных по школе на сервере; SQL-политики RLS лежат в `supabase/rls.sql`.
- Настройка двух смен и профилей звонков с разной длительностью урока.
- Скачивание Excel-шаблонов, предпросмотр, отчёт об ошибках и атомарный импорт.
- Учебный план и **редактируемый справочник нормативных часов** (не зашит в код).
- Недельная сетка, ручное редактирование, блокировка конфликтов.
- Генератор черновика (backtracking + MRV) или диагностический отчёт.
- Публикация только без жёстких конфликтов; экспорт класса/учителя в Excel и печать.

## Стек

Next.js (App Router) · TypeScript · Tailwind CSS · Prisma · PostgreSQL (Supabase) · Zod · React Hook Form · SheetJS · Vitest

## Локальный запуск

1. Создайте проект на [Supabase](https://supabase.com) и включите Email-провайдер (password).
2. Скопируйте переменные:

```bash
cp .env.example .env.local
```

Заполните `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`, `DIRECT_URL`.

`DATABASE_URL` — pooled-строка (порт **6543**, Transaction pooler) с `?pgbouncer=true`.  
`DIRECT_URL` — прямое подключение (порт **5432**) для миграций.

3. Примените схему и политики:

```bash
npx prisma migrate deploy
npx prisma db execute --file supabase/rls.sql --schema prisma/schema.prisma
npm run db:seed
```

4. Создайте пользователя в Supabase Authentication (email + пароль) **или** задайте `SUPABASE_SERVICE_ROLE_KEY` до сида — тогда появятся демо-аккаунты:

| Email | Роль | Пароль |
| --- | --- | --- |
| `zavuch@demo.school` | завуч | `DemoSchool2026!` |
| `admin@demo.school` | super_admin | `DemoSchool2026!` |
| `viewer@demo.school` | просмотр | `DemoSchool2026!` |

Если ключ сервиса не задан, после ручной регистрации привяжите профиль:

```sql
insert into "UserProfile" ("id", "userId", "email", "fullName", "role", "schoolId")
values (
  gen_random_uuid()::text,
  '<auth.users.id>',
  'you@school.kz',
  'Завуч',
  'school_admin',
  '<School.id>'
);
```

5. Запустите приложение:

```bash
npm run dev
```

Откройте http://localhost:3000.

## Команды

```bash
npm run dev          # разработка
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run test         # unit-тесты генератора и конфликтов
npm run build        # prisma generate + migrate deploy + next build
```

## Импорт Excel

Стратегия по умолчанию — **upsert по естественному ключу**. Опция «Полностью заменить этот справочник» удаляет записи текущего типа, которых нет в файле.

| Файл | Ключ |
| --- | --- |
| Классы.xlsx | параллель + буква |
| Учителя.xlsx | ФИО |
| Кабинеты.xlsx | название |
| Учебная нагрузка.xlsx | класс + предмет |
| Нормы часов.xlsx | параллель + предмет + язык + тип плана |

Невалидный файл **целиком отклоняется**: частичная запись в БД не выполняется.

Нормативные часы из методички **не зашиты в код**. В сидах есть помеченный демонстрационный справочник — его нужно заменить данными школы.

## Vercel

В **Settings → Environment Variables** для Production (и Preview) задайте:

| Переменная | Откуда в Supabase |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public key |
| `DATABASE_URL` | Connect → Transaction pooler, порт **6543**, добавьте `?pgbouncer=true` |
| `DIRECT_URL` | Connect → Session / Direct, порт **5432** (без pgbouncer) |

`DIRECT_URL` нужна для `prisma migrate deploy`. Если её нет, сборка подставит `DATABASE_URL`, но миграции через pooler часто ломаются — лучше задать обе.

Затем: Build Command `npm run build`. В Supabase → Authentication → URL Configuration добавьте домен Vercel в Redirect URLs.

Часовой пояс отображения: `Asia/Almaty`. Время уроков хранится как локальное `HH:mm`.

## Ограничения MVP

- Генератор детерминированный, с лимитом итераций; сложные сетки могут завершиться отчётом о неразмещённых уроках, а не «магическим» полным решением.
- Суббота включается настройкой учебного года; воскресенье не используется.
- Дробные часы нагрузки (не целое число уроков) при генерации округляются с предупреждением.
- Нет мобильного приложения, оплаты, публичного каталога школ и LLM-генерации.
