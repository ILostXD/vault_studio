CREATE TABLE provider_connections (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    environment TEXT NOT NULL,
    encrypted_token BLOB NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, provider, environment)
);

CREATE TABLE provider_oauth_states (
    state_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    environment TEXT NOT NULL,
    encrypted_verifier BLOB NOT NULL,
    expires_at INTEGER NOT NULL,
    UNIQUE (user_id, provider, environment)
);
