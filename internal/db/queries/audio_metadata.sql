-- name: GetProjectAudioMetadata :one
SELECT * FROM project_audio_metadata WHERE project_id = ?;

-- name: SaveProjectAudioMetadata :exec
INSERT INTO project_audio_metadata (project_id, album_artist, genre, year)
VALUES (?, ?, ?, ?)
ON CONFLICT(project_id) DO UPDATE SET album_artist = excluded.album_artist, genre = excluded.genre, year = excluded.year;

-- name: UpdateProjectAudioIdentity :execrows
UPDATE projects SET name = ?, author_override = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ?;

-- name: ListAudioMetadataTracks :many
SELECT t.id, t.public_id, t.title, t.artist, t.album, t.active_version_id, tv.version_name,
       tf.id AS file_id, tf.file_path, tf.format
FROM tracks t
LEFT JOIN track_versions tv ON tv.id = t.active_version_id AND tv.track_id = t.id
LEFT JOIN track_files tf ON tf.version_id = tv.id AND tf.quality = 'source' AND tf.transcoding_status = 'completed'
WHERE t.project_id = ?
ORDER BY t.track_order, t.id;

-- name: CopyProjectAudioMetadata :exec
INSERT INTO project_audio_metadata (project_id, album_artist, genre, year)
SELECT sqlc.arg(destination_id), source.album_artist, source.genre, source.year FROM project_audio_metadata source
WHERE source.project_id = sqlc.arg(source_id);
