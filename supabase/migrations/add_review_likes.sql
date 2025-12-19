-- Создаём таблицу для лайков рецензий
CREATE TABLE IF NOT EXISTS review_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(review_id, user_id)
);

-- Добавляем колонку для подсчёта лайков в таблицу reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0;

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_review_likes_review_id ON review_likes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_likes_user_id ON review_likes(user_id);

-- Функция для обновления счётчика лайков
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
DROP TRIGGER IF EXISTS review_likes_count_trigger ON review_likes;
CREATE TRIGGER review_likes_count_trigger
AFTER INSERT OR DELETE ON review_likes
FOR EACH ROW
EXECUTE FUNCTION update_review_likes_count();

-- Комментарии
COMMENT ON TABLE review_likes IS 'Likes for reviews from authorized users';
COMMENT ON COLUMN review_likes.review_id IS 'Reference to the review';
COMMENT ON COLUMN review_likes.user_id IS 'User who liked the review';
