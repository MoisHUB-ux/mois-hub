-- Добавляем колонку tags вместо genre
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS tags text[];

-- Если хочешь мигрировать существующие данные:
-- UPDATE tracks SET tags = ARRAY[genre] WHERE genre IS NOT NULL;

-- Опционально: можно удалить колонку genre после миграции
-- ALTER TABLE tracks DROP COLUMN IF EXISTS genre;

-- Создаем индекс для быстрого поиска по тегам
CREATE INDEX IF NOT EXISTS idx_tracks_tags ON tracks USING GIN(tags);

-- Комментарий
COMMENT ON COLUMN tracks.tags IS 'Array of tags (hashtags) for the track, space-separated input';
