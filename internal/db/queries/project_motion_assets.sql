-- name: UpsertProjectMotionAsset :one
INSERT INTO project_motion_assets (
    project_id,
    kind,
    source_path,
    source_mime,
    preview_path,
    preview_mime,
    width,
    height,
    duration_seconds,
    codec,
    frame_rate,
    bitrate,
    has_audio
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(project_id, kind) DO UPDATE SET
    source_path = excluded.source_path,
    source_mime = excluded.source_mime,
    preview_path = excluded.preview_path,
    preview_mime = excluded.preview_mime,
    width = excluded.width,
    height = excluded.height,
    duration_seconds = excluded.duration_seconds,
    codec = excluded.codec,
    frame_rate = excluded.frame_rate,
    bitrate = excluded.bitrate,
    has_audio = excluded.has_audio,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: GetProjectMotionAsset :one
SELECT * FROM project_motion_assets
WHERE project_id = ? AND kind = ?;

-- name: ListProjectMotionAssets :many
SELECT * FROM project_motion_assets
WHERE project_id = ?
ORDER BY kind;

-- name: DeleteProjectMotionAsset :exec
DELETE FROM project_motion_assets
WHERE project_id = ? AND kind = ?;
