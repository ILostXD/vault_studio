-- name: GetProviderSetting :one
SELECT * FROM provider_settings WHERE provider = ?;

-- name: SaveProviderSetting :exec
INSERT INTO provider_settings (provider, encrypted_config)
VALUES (?, ?)
ON CONFLICT(provider) DO UPDATE SET
    encrypted_config = excluded.encrypted_config,
    updated_at = CURRENT_TIMESTAMP;
