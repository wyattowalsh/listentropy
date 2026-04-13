import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message)
})

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params)
}

export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect()
}

export async function runMigrations(): Promise<void> {
  console.log('[db] Running migrations...')

  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      spotify_id TEXT UNIQUE NOT NULL,
      display_name TEXT,
      email TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS spotify_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      spotify_id TEXT NOT NULL,
      access_token_encrypted TEXT NOT NULL,
      refresh_token_encrypted TEXT NOT NULL,
      token_expires_at TIMESTAMPTZ NOT NULL,
      scopes TEXT[] NOT NULL DEFAULT '{}',
      connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_refreshed_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
      UNIQUE (user_id, spotify_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      csrf_token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ip_address TEXT,
      user_agent TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_spotify_connections_user_id ON spotify_connections(user_id);
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS consent_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      consent_type TEXT NOT NULL CHECK (consent_type IN ('persist_history', 'persist_enrichment', 'aggregate_analytics')),
      granted BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_consent_events_user_id ON consent_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_consent_events_user_type ON consent_events(user_id, consent_type, created_at DESC);

    CREATE TABLE IF NOT EXISTS datasets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('spotify_export', 'spotify_api', 'merged')),
      status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error', 'deleted')),
      record_count INTEGER NOT NULL DEFAULT 0,
      file_size_bytes BIGINT,
      date_range_start TIMESTAMPTZ,
      date_range_end TIMESTAMPTZ,
      history_file_count INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON datasets(user_id);

    CREATE TABLE IF NOT EXISTS listening_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
      dedup_hash TEXT NOT NULL,
      ts TIMESTAMPTZ NOT NULL,
      platform TEXT NOT NULL DEFAULT 'unknown',
      ms_played INTEGER NOT NULL DEFAULT 0,
      conn_country TEXT NOT NULL DEFAULT 'ZZ',
      master_metadata_track_name TEXT,
      master_metadata_album_artist_name TEXT,
      master_metadata_album_album_name TEXT,
      spotify_track_uri TEXT,
      episode_name TEXT,
      episode_show_name TEXT,
      spotify_episode_uri TEXT,
      reason_start TEXT NOT NULL DEFAULT 'unknown',
      reason_end TEXT NOT NULL DEFAULT 'unknown',
      shuffle BOOLEAN NOT NULL DEFAULT false,
      skipped BOOLEAN NOT NULL DEFAULT false,
      offline BOOLEAN NOT NULL DEFAULT false,
      offline_timestamp BIGINT,
      incognito_mode BOOLEAN NOT NULL DEFAULT false,
      content_type TEXT NOT NULL DEFAULT 'music' CHECK (content_type IN ('music', 'podcast', 'audiobook')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_listening_events_dedup ON listening_events(user_id, dedup_hash);
    CREATE INDEX IF NOT EXISTS idx_listening_events_user_id ON listening_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_listening_events_dataset_id ON listening_events(dataset_id);
    CREATE INDEX IF NOT EXISTS idx_listening_events_ts ON listening_events(user_id, ts);
  `)

  console.log('[db] Migrations complete.')
}

export default pool
