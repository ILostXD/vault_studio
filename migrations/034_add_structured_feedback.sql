ALTER TABLE share_tokens ADD COLUMN feedback_question TEXT;
ALTER TABLE project_share_tokens ADD COLUMN feedback_question TEXT;

CREATE TABLE waveform_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL REFERENCES track_versions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    timestamp_seconds REAL NOT NULL CHECK (timestamp_seconds >= 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (length(author_name) BETWEEN 1 AND 80),
    CHECK (length(comment_text) BETWEEN 1 AND 2000)
);

CREATE INDEX idx_waveform_comments_version_timestamp
ON waveform_comments(version_id, timestamp_seconds, created_at);
