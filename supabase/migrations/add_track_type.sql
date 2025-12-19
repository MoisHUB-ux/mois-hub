-- Добавляем поле track_type (оригинал/кавер) и название оригинала
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS track_type text DEFAULT 'original' CHECK (track_type IN ('original', 'cover'));
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS original_title text;

-- Комментарии
COMMENT ON COLUMN tracks.track_type IS 'Type of track: original or cover';
COMMENT ON COLUMN tracks.original_title IS 'Original song title and artist (for covers)';
