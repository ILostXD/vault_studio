CREATE TABLE project_motion_assets (
    project_id INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('apple_square', 'apple_portrait', 'spotify_canvas')),
    source_path TEXT NOT NULL,
    source_mime TEXT NOT NULL,
    preview_path TEXT NOT NULL,
    preview_mime TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    duration_seconds REAL NOT NULL,
    codec TEXT NOT NULL,
    frame_rate REAL NOT NULL,
    bitrate INTEGER NOT NULL,
    has_audio BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, kind),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
