ALTER TABLE user_preferences
ADD COLUMN key_mode_preference TEXT NOT NULL DEFAULT 'detected'
CHECK (key_mode_preference IN ('detected', 'major', 'minor'));
