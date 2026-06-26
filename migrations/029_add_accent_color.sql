-- Add accent_color to user_preferences
ALTER TABLE user_preferences ADD COLUMN accent_color TEXT NOT NULL DEFAULT '#ffba00';
