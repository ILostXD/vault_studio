-- name: GetProviderConnection :one
SELECT * FROM provider_connections WHERE user_id = ? AND provider = ? AND environment = ?;

-- name: SaveProviderConnection :exec
INSERT INTO provider_connections (user_id, provider, environment, encrypted_token)
VALUES (?, ?, ?, ?)
ON CONFLICT(user_id, provider, environment) DO UPDATE SET encrypted_token = excluded.encrypted_token, updated_at = CURRENT_TIMESTAMP;

-- name: DeleteProviderConnection :exec
DELETE FROM provider_connections WHERE user_id = ? AND provider = ? AND environment = ?;

-- name: SaveProviderOAuthState :exec
INSERT INTO provider_oauth_states (state_hash, user_id, provider, environment, encrypted_verifier, expires_at)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(user_id, provider, environment) DO UPDATE SET state_hash = excluded.state_hash, encrypted_verifier = excluded.encrypted_verifier, expires_at = excluded.expires_at;

-- name: ConsumeProviderOAuthState :one
DELETE FROM provider_oauth_states WHERE state_hash = ? AND expires_at > ? RETURNING *;

-- name: DeleteProviderOAuthStates :exec
DELETE FROM provider_oauth_states WHERE user_id = ? AND provider = ? AND environment = ?;

-- name: ExpireProviderOAuthStates :exec
DELETE FROM provider_oauth_states WHERE expires_at <= ?;
