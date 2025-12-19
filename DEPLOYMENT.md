# 🚀 Инструкции по деплою

## ✅ Код задеплоен в GitHub

Коммит: `fb0a916`  
Ветка: `main`

## 🗄️ ВАЖНО: Выполните миграции в Supabase

Перед использованием новых функций необходимо выполнить SQL миграции в Supabase:

### Шаг 1: Откройте SQL Editor в Supabase

1. Перейдите на [https://supabase.com](https://supabase.com)
2. Откройте ваш проект MOIS Hub
3. В левом меню выберите **SQL Editor**

### Шаг 2: Выполните миграции по порядку

#### 1. Система тегов (обязательно)

```sql
-- Файл: supabase/migrations/add_tags_system.sql
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS tags text[];

-- Индекс для быстрого поиска по тегам
CREATE INDEX IF NOT EXISTS idx_tracks_tags ON tracks USING GIN(tags);
```

#### 2. Типы треков (обязательно)

```sql
-- Файл: supabase/migrations/add_track_type.sql
ALTER TABLE tracks 
  ADD COLUMN IF NOT EXISTS track_type text CHECK (track_type IN ('original', 'cover')),
  ADD COLUMN IF NOT EXISTS original_title text;

-- Устанавливаем значение по умолчанию для существующих треков
UPDATE tracks SET track_type = 'original' WHERE track_type IS NULL;
```

#### 3. Профили (обязательно)

```sql
-- Добавляем поля для профиля
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS smule_nickname text,
  ADD COLUMN IF NOT EXISTS bio text;

-- Устанавливаем всех пользователей как 'both'
UPDATE profiles SET account_type = 'both' WHERE account_type IS NULL;
```

#### 4. Лайки рецензий (обязательно)

```sql
-- Файл: supabase/migrations/add_review_likes.sql

-- Добавляем поле likes_count в таблицу reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0;

-- Создаём таблицу для хранения лайков
CREATE TABLE IF NOT EXISTS review_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid REFERENCES reviews(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(review_id, user_id)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_review_likes_review_id ON review_likes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_likes_user_id ON review_likes(user_id);

-- RLS политики для review_likes
ALTER TABLE review_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view review likes"
  ON review_likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can like reviews"
  ON review_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike their own likes"
  ON review_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Функция для автоматического обновления likes_count
CREATE OR REPLACE FUNCTION update_review_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE reviews SET likes_count = likes_count + 1 WHERE id = NEW.review_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reviews SET likes_count = likes_count - 1 WHERE id = OLD.review_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления
DROP TRIGGER IF EXISTS trigger_update_review_likes_count ON review_likes;
CREATE TRIGGER trigger_update_review_likes_count
  AFTER INSERT OR DELETE ON review_likes
  FOR EACH ROW EXECUTE FUNCTION update_review_likes_count();
```

### Шаг 3: Проверьте выполнение

После выполнения всех миграций проверьте:

```sql
-- Проверка полей tracks
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tracks' 
AND column_name IN ('tags', 'track_type', 'original_title');

-- Проверка полей profiles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('smule_nickname', 'bio');

-- Проверка таблицы review_likes
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'review_likes'
);

-- Проверка поля likes_count
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reviews' 
AND column_name = 'likes_count';
```

## 🌐 Netlify деплой

Netlify автоматически запустит деплой после пуша в `main`:

1. Следите за процессом: https://app.netlify.com/sites/YOUR_SITE/deploys
2. Обычно деплой занимает 2-5 минут
3. После завершения сайт будет доступен на вашем домене

## ⚙️ Переменные окружения в Netlify

Убедитесь, что в Netlify настроены переменные:

- `NEXT_PUBLIC_SUPABASE_URL` - URL вашего Supabase проекта
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon ключ Supabase

## 🧪 Тестирование после деплоя

После успешного деплоя протестируйте:

1. ✅ Загрузка файла с тегами
2. ✅ Импорт со Smule (вставьте URL записи)
3. ✅ Фильтрация по типу трека (original/cover)
4. ✅ Лайки на рецензиях (клик на ❤️)
5. ✅ Профиль редактирование (/settings)
6. ✅ Новые рецензии на главной
7. ✅ Запрет самооценивания

## 📝 Changelog

### Версия 2.0.0 (19.12.2024)

**Основные функции:**
- 🎤 Интеграция Smule API для импорта записей
- 🏷️ Система тегов (TikTok-style hashtags)
- 📊 Типы треков (оригинал/кавер)
- ❤️ Лайки на рецензиях
- 🚫 Защита от самооценивания
- ⚙️ Страница редактирования профиля

**Улучшения:**
- 📱 Оптимизация мобильной загрузки
- 🔔 Система toast-уведомлений
- ⚠️ Централизованная обработка ошибок
- 🔒 Rate limiting загрузок
- ✅ Улучшенная валидация файлов
- ♿ ARIA labels для accessibility
- 📄 Пагинация треков

**Технические:**
- Добавлен пакет `smule-api`
- Новые API endpoints
- SQL миграции для БД
- Рефакторинг компонентов

## 🆘 Поддержка

Если возникли проблемы при деплое:

1. Проверьте логи Netlify
2. Убедитесь, что миграции выполнены
3. Проверьте переменные окружения
4. Обратитесь к администратору

---

**Статус:** ✅ Готово к продакшену  
**Дата:** 19.12.2024  
**Автор:** GitHub Copilot
