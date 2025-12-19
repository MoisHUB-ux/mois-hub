-- ========================================
-- MOIS Hub Database Migrations
-- Выполните все миграции в Supabase SQL Editor
-- ========================================

-- ========================================
-- 1. СИСТЕМА ТЕГОВ
-- ========================================

-- Добавляем колонку для тегов
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS tags text[];

-- Индекс для быстрого поиска по тегам (GIN index для массивов)
CREATE INDEX IF NOT EXISTS idx_tracks_tags ON tracks USING GIN(tags);

-- ========================================
-- 2. ТИПЫ ТРЕКОВ (Original/Cover)
-- ========================================

-- Добавляем колонки для типа трека и названия оригинала
ALTER TABLE tracks 
  ADD COLUMN IF NOT EXISTS track_type text CHECK (track_type IN ('original', 'cover')),
  ADD COLUMN IF NOT EXISTS original_title text;

-- Устанавливаем значение по умолчанию для существующих треков
UPDATE tracks SET track_type = 'original' WHERE track_type IS NULL;

-- ========================================
-- 3. ОБНОВЛЕНИЕ ПРОФИЛЕЙ
-- ========================================

-- Добавляем поля для Smule и био
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS smule_nickname text,
  ADD COLUMN IF NOT EXISTS bio text;

-- Устанавливаем всех пользователей как 'both' (author + reviewer)
UPDATE profiles SET account_type = 'both' WHERE account_type IS NULL;

-- ========================================
-- 4. СИСТЕМА ЛАЙКОВ ДЛЯ РЕЦЕНЗИЙ
-- ========================================

-- Добавляем счётчик лайков в reviews
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

-- ========================================
-- 5. RLS ПОЛИТИКИ ДЛЯ ЛАЙКОВ
-- ========================================

-- Включаем Row Level Security
ALTER TABLE review_likes ENABLE ROW LEVEL SECURITY;

-- Политика: Любой может просматривать лайки
DROP POLICY IF EXISTS "Anyone can view review likes" ON review_likes;
CREATE POLICY "Anyone can view review likes"
  ON review_likes FOR SELECT
  USING (true);

-- Политика: Авторизованные пользователи могут ставить лайки
DROP POLICY IF EXISTS "Authenticated users can like reviews" ON review_likes;
CREATE POLICY "Authenticated users can like reviews"
  ON review_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Политика: Пользователи могут убирать свои лайки
DROP POLICY IF EXISTS "Users can unlike their own likes" ON review_likes;
CREATE POLICY "Users can unlike their own likes"
  ON review_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ========================================
-- 6. ТРИГГЕР ДЛЯ АВТООБНОВЛЕНИЯ ЛАЙКОВ
-- ========================================

-- Функция для автоматического обновления счётчика лайков
CREATE OR REPLACE FUNCTION update_review_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- При добавлении лайка увеличиваем счётчик
    UPDATE reviews SET likes_count = likes_count + 1 WHERE id = NEW.review_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- При удалении лайка уменьшаем счётчик
    UPDATE reviews SET likes_count = likes_count - 1 WHERE id = OLD.review_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Создаём триггер (удаляем старый если есть)
DROP TRIGGER IF EXISTS trigger_update_review_likes_count ON review_likes;
CREATE TRIGGER trigger_update_review_likes_count
  AFTER INSERT OR DELETE ON review_likes
  FOR EACH ROW EXECUTE FUNCTION update_review_likes_count();

-- ========================================
-- 7. ПРОВЕРКА ВЫПОЛНЕНИЯ
-- ========================================

-- Раскомментируйте и выполните для проверки:

-- -- Проверка полей tracks
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_name = 'tracks' 
-- AND column_name IN ('tags', 'track_type', 'original_title');

-- -- Проверка полей profiles
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' 
-- AND column_name IN ('smule_nickname', 'bio', 'account_type');

-- -- Проверка таблицы review_likes
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns 
-- WHERE table_name = 'review_likes'
-- ORDER BY ordinal_position;

-- -- Проверка поля likes_count в reviews
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'reviews' 
-- AND column_name = 'likes_count';

-- -- Проверка триггера
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_name = 'trigger_update_review_likes_count';

-- -- Проверка RLS политик
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'review_likes';

-- ========================================
-- ГОТОВО! ✅
-- ========================================
-- После выполнения всех миграций:
-- 1. Проверьте результаты запросами выше
-- 2. Перезапустите приложение если необходимо
-- 3. Протестируйте новые функции
-- ========================================
