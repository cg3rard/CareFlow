-- Careflow PostgreSQL schema
-- The backend executes this migration automatically when DATABASE_URL is configured.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mood VARCHAR(80) NOT NULL,
  mascot VARCHAR(80) NOT NULL,
  completed_tasks_count SMALLINT NOT NULL CHECK (completed_tasks_count BETWEEN 0 AND 3),
  total_xp INTEGER NOT NULL CHECK (total_xp >= 0)
);

CREATE INDEX IF NOT EXISTS sessions_user_created_at_idx ON sessions (user_id, created_at DESC);
