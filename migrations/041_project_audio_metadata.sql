CREATE TABLE project_audio_metadata (
    project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    album_artist TEXT NOT NULL DEFAULT '',
    genre TEXT NOT NULL DEFAULT '',
    year TEXT NOT NULL DEFAULT '' CHECK(year = '' OR (length(year) = 4 AND year NOT GLOB '*[^0-9]*' AND year != '0000'))
);
