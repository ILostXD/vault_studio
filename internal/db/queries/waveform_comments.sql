-- name: CreateWaveformComment :one
INSERT INTO waveform_comments (
    version_id, user_id, author_name, comment_text, timestamp_seconds
)
VALUES (?, ?, ?, ?, ?)
RETURNING *;

-- name: ListWaveformCommentsByVersion :many
SELECT * FROM waveform_comments
WHERE version_id = ?
ORDER BY timestamp_seconds ASC, created_at ASC;

-- name: UpdateWaveformComment :one
UPDATE waveform_comments
SET comment_text = ?
WHERE id = ? AND user_id = ?
RETURNING *;

-- name: DeleteWaveformComment :execrows
DELETE FROM waveform_comments
WHERE id = ? AND user_id = ?;
