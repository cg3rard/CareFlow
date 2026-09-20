-- Careflow PostgreSQL schema
-- The backend executes this migration automatically when DATABASE_URL is configured.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  date_of_birth DATE,
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

-- Daily sleep duration & stress indicator, one row per user per calendar day.
-- Used to render the last-7-day sleep/stress trend on the Daily Mood Triage page.
CREATE TABLE IF NOT EXISTS daily_metrics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  sleep_hours NUMERIC(4,1) CHECK (sleep_hours IS NULL OR (sleep_hours >= 0 AND sleep_hours <= 24)),
  stress_score SMALLINT CHECK (stress_score IS NULL OR (stress_score BETWEEN 0 AND 100)),
  stress_label VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, metric_date)
);

CREATE INDEX IF NOT EXISTS daily_metrics_user_date_idx ON daily_metrics (user_id, metric_date DESC);

-- Cognitive de-clutter (brain-dump) answers submitted from the triage screen.
CREATE TABLE IF NOT EXISTS cognitive_declutter_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tag VARCHAR(80) NOT NULL,
  panic_level SMALLINT NOT NULL CHECK (panic_level BETWEEN 1 AND 5),
  overwhelm_level VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS declutter_entries_user_created_at_idx ON cognitive_declutter_entries (user_id, created_at DESC);

