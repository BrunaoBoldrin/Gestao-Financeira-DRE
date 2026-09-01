CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS application_state_meta (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    revision BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by_id TEXT
);

INSERT INTO application_state_meta (singleton, revision)
VALUES (TRUE, 0)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_entities (
    collection TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload_nonce BYTEA NOT NULL,
    payload_ciphertext BYTEA NOT NULL,
    key_version SMALLINT NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_app_entities_collection
    ON app_entities (collection);

CREATE TABLE IF NOT EXISTS app_singletons (
    state_key TEXT PRIMARY KEY,
    payload_nonce BYTEA NOT NULL,
    payload_ciphertext BYTEA NOT NULL,
    key_version SMALLINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_files (
    id UUID PRIMARY KEY,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    sha256 CHAR(64) NOT NULL UNIQUE,
    metadata_nonce BYTEA NOT NULL,
    metadata_ciphertext BYTEA NOT NULL,
    content_nonce BYTEA NOT NULL,
    content_ciphertext BYTEA NOT NULL,
    key_version SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_files_created_at
    ON document_files (created_at DESC);

CREATE TABLE IF NOT EXISTS auth_users (
    id UUID PRIMARY KEY,
    email_lookup CHAR(64) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    profile_nonce BYTEA NOT NULL,
    profile_ciphertext BYTEA NOT NULL,
    key_version SMALLINT NOT NULL DEFAULT 1,
    role TEXT NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('ADMIN', 'FINANCE', 'AUDITOR')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
    ON auth_sessions (user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS auth_login_attempts (
    id BIGSERIAL PRIMARY KEY,
    email_lookup CHAR(64) NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    successful BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_lookup
    ON auth_login_attempts (email_lookup, attempted_at DESC);

INSERT INTO schema_migrations (version)
VALUES (1)
ON CONFLICT (version) DO NOTHING;
