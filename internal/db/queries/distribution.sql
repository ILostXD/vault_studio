-- name: GetDistributionProfile :one
SELECT * FROM distribution_artist_profiles WHERE user_id = ?;

-- name: SaveDistributionProfile :exec
INSERT INTO distribution_artist_profiles (user_id, profile_json) VALUES (?, ?)
ON CONFLICT(user_id) DO UPDATE SET profile_json = excluded.profile_json, updated_at = CURRENT_TIMESTAMP;

-- name: GetDistributionPreparation :one
SELECT dp.* FROM distribution_preparations dp
JOIN projects p ON p.id = dp.project_id
WHERE dp.project_id = ? AND p.user_id = ?;

-- name: SaveDistributionPreparation :execrows
INSERT INTO distribution_preparations (project_id, preparation_json)
SELECT id, sqlc.arg(preparation_json) FROM projects WHERE id = sqlc.arg(project_id) AND user_id = sqlc.arg(user_id)
ON CONFLICT(project_id) DO UPDATE SET preparation_json = excluded.preparation_json, updated_at = CURRENT_TIMESTAMP;

-- name: ListDistributionTracks :many
SELECT t.id, t.title, t.artist, t.active_version_id, tv.duration_seconds,
       tf.id AS file_id, tf.file_path, tf.file_size, tf.format, tf.original_filename
FROM tracks t
JOIN projects p ON p.id = t.project_id
LEFT JOIN track_versions tv ON tv.id = t.active_version_id AND tv.track_id = t.id
LEFT JOIN track_files tf ON tf.version_id = tv.id AND tf.quality = 'source' AND tf.transcoding_status = 'completed'
WHERE p.id = ? AND p.user_id = ?
ORDER BY t.track_order, t.id;

-- name: CreateDistributionHistory :one
INSERT INTO distribution_history (project_id, user_id, kind, provider, environment, snapshot_json)
SELECT p.id, p.user_id, sqlc.arg(kind), sqlc.arg(provider), sqlc.arg(environment), sqlc.arg(snapshot_json)
FROM projects p WHERE p.id = sqlc.arg(project_id) AND p.user_id = sqlc.arg(user_id)
RETURNING *;

-- name: ListDistributionHistory :many
SELECT h.* FROM distribution_history h JOIN projects p ON p.id = h.project_id
WHERE h.project_id = ? AND h.user_id = ? AND p.user_id = h.user_id
ORDER BY h.id DESC;

-- name: GetDistributionHistory :one
SELECT h.* FROM distribution_history h JOIN projects p ON p.id = h.project_id
WHERE h.id = ? AND h.project_id = ? AND h.user_id = ? AND p.user_id = h.user_id;

-- name: UpdateDistributionHistory :one
UPDATE distribution_history
SET status = COALESCE(sqlc.narg(status), status),
    remote_id = COALESCE(sqlc.narg(remote_id), remote_id),
    provider_status = COALESCE(sqlc.narg(provider_status), provider_status),
    message = COALESCE(sqlc.narg(message), message), updated_at = CURRENT_TIMESTAMP
WHERE distribution_history.id = sqlc.arg(id)
  AND distribution_history.project_id = sqlc.arg(project_id)
  AND distribution_history.user_id = sqlc.arg(user_id)
  AND status = 'pending'
  AND EXISTS (SELECT 1 FROM projects p WHERE p.id = distribution_history.project_id AND p.user_id = distribution_history.user_id)
RETURNING *;

-- name: UpdateDistributionRemoteStatus :one
UPDATE distribution_history
SET provider_status = ?,
    message = CASE WHEN sqlc.arg(message) = '' THEN message ELSE sqlc.arg(message) END,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND project_id = ? AND user_id = ? AND provider != '' AND remote_id != ''
RETURNING *;
