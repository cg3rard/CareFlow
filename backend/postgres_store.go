package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"golang.org/x/crypto/bcrypt"
)

const databaseTimeout = 5 * time.Second

func newPostgresStore(databaseURL string) (*Store, error) {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open PostgreSQL: %w", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("connect PostgreSQL: %w", err)
	}
	store := &Store{db: db, tokens: make(map[string]string)}
	if err := store.migratePostgres(ctx); err != nil {
		db.Close()
		return nil, err
	}
	return store, nil
}

func (s *Store) migratePostgres(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			name VARCHAR(80) NOT NULL,
			email VARCHAR(254) NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			date_of_birth DATE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
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
		CREATE TABLE IF NOT EXISTS cognitive_declutter_entries (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			content TEXT NOT NULL,
			tag VARCHAR(80) NOT NULL,
			panic_level SMALLINT NOT NULL CHECK (panic_level BETWEEN 1 AND 5),
			overwhelm_level VARCHAR(20) NOT NULL,
			share_with_psychologist BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		ALTER TABLE cognitive_declutter_entries ADD COLUMN IF NOT EXISTS share_with_psychologist BOOLEAN NOT NULL DEFAULT FALSE;
		CREATE INDEX IF NOT EXISTS declutter_entries_user_created_at_idx ON cognitive_declutter_entries (user_id, created_at DESC);
		CREATE TABLE IF NOT EXISTS task_completions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			xp INTEGER NOT NULL CHECK (xp >= 0),
			completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS task_completions_user_completed_at_idx ON task_completions (user_id, completed_at DESC);
		CREATE TABLE IF NOT EXISTS community_posts (
			id            TEXT PRIMARY KEY,
			author_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			is_anonymous  BOOLEAN NOT NULL DEFAULT FALSE,
			topic_tag     TEXT NOT NULL DEFAULT 'umum',
			body          TEXT NOT NULL,
			media_mime    TEXT,
			media_data    TEXT,
			media_bytes   INTEGER NOT NULL DEFAULT 0,
			created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts (created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_community_posts_author ON community_posts (author_id, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_community_posts_named_author ON community_posts (author_id, created_at DESC) WHERE is_anonymous = FALSE;
		CREATE TABLE IF NOT EXISTS community_comments (
			id         TEXT PRIMARY KEY,
			post_id    TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
			author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			body       TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments (post_id, created_at ASC);
		CREATE INDEX IF NOT EXISTS idx_community_comments_author ON community_comments (author_id, created_at DESC);
		CREATE TABLE IF NOT EXISTS community_reactions (
			id         TEXT PRIMARY KEY,
			post_id    TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
			user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (post_id, user_id)
		);
		CREATE INDEX IF NOT EXISTS idx_community_reactions_post ON community_reactions (post_id);
		CREATE TABLE IF NOT EXISTS community_shares (
			id         TEXT PRIMARY KEY,
			post_id    TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
			user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_community_shares_post ON community_shares (post_id);
	`)
	if err != nil {
		return fmt.Errorf("migrate PostgreSQL: %w", err)
	}
	return nil
}

func (s *Store) close() {
	if s.db != nil {
		_ = s.db.Close()
	}
}

func ensureDemoAccount(store *Store, cfg Config) error {
	_, _, loginErr := store.login(cfg.DemoEmail, cfg.DemoPassword)
	if loginErr == nil {
		return nil
	}
	_, _, createErr := store.createUser(Credentials{Name: cfg.DemoName, Email: cfg.DemoEmail, Password: cfg.DemoPassword})
	if createErr != nil && !strings.Contains(createErr.Error(), "already registered") {
		return createErr
	}
	return nil
}

func (s *Store) createUserPostgres(name, email, passwordHash string, dateOfBirth *string) (User, string, error) {
	user := User{ID: newID(), Name: name, Email: email, PasswordHash: passwordHash, DateOfBirth: dateOfBirth, CreatedAt: time.Now().UTC()}
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	_, err := s.db.ExecContext(ctx, `INSERT INTO users (id, name, email, password_hash, date_of_birth, created_at) VALUES ($1, $2, $3, $4, $5, $6)`, user.ID, user.Name, user.Email, user.PasswordHash, user.DateOfBirth, user.CreatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return User{}, "", errors.New("email is already registered")
		}
		return User{}, "", fmt.Errorf("save account: %w", err)
	}
	s.mu.Lock()
	token := s.createTokenLocked(user.ID)
	s.mu.Unlock()
	return user, token, nil
}

func (s *Store) loginPostgres(email, password string) (User, string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	var user User
	var dateOfBirth sql.NullString
	err := s.db.QueryRowContext(ctx, `SELECT id, name, email, password_hash, date_of_birth::text, created_at FROM users WHERE email = $1`, email).Scan(&user.ID, &user.Name, &user.Email, &user.PasswordHash, &dateOfBirth, &user.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return User{}, "", errors.New("incorrect email or password")
		}
		return User{}, "", fmt.Errorf("fetch account: %w", err)
	}
	if dateOfBirth.Valid {
		user.DateOfBirth = &dateOfBirth.String
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return User{}, "", errors.New("incorrect email or password")
	}
	s.mu.Lock()
	token := s.createTokenLocked(user.ID)
	s.mu.Unlock()
	return user, token, nil
}

func (s *Store) userByIDPostgres(userID string) (User, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	var user User
	var dateOfBirth sql.NullString
	err := s.db.QueryRowContext(ctx, `SELECT id, name, email, password_hash, date_of_birth::text, created_at FROM users WHERE id = $1`, userID).Scan(&user.ID, &user.Name, &user.Email, &user.PasswordHash, &dateOfBirth, &user.CreatedAt)
	if err != nil {
		return User{}, false
	}
	if dateOfBirth.Valid {
		user.DateOfBirth = &dateOfBirth.String
	}
	return user, true
}

func (s *Store) addSessionPostgres(record SessionRecord) (SessionRecord, error) {
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	_, err := s.db.ExecContext(ctx, `INSERT INTO sessions (id, user_id, created_at, mood, mascot, completed_tasks_count, total_xp) VALUES ($1, $2, $3, $4, $5, $6, $7)`, record.ID, record.UserID, record.CreatedAt, record.Mood, record.Mascot, record.CompletedTasksCount, record.TotalXP)
	if err != nil {
		return SessionRecord{}, fmt.Errorf("simpan sesi: %w", err)
	}
	return record, nil
}

func (s *Store) sessionsForUserPostgres(userID string) ([]SessionRecord, error) {
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	rows, err := s.db.QueryContext(ctx, `SELECT id, user_id, created_at, mood, mascot, completed_tasks_count, total_xp FROM sessions WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]SessionRecord, 0)
	for rows.Next() {
		var record SessionRecord
		if err := rows.Scan(&record.ID, &record.UserID, &record.CreatedAt, &record.Mood, &record.Mascot, &record.CompletedTasksCount, &record.TotalXP); err != nil {
			return nil, err
		}
		result = append(result, record)
	}
	return result, rows.Err()
}

func (s *Store) upsertDailyMetricPostgres(userID, metricDate string, sleepHours *float64, stressScore *int, stressLabel string) (DailyMetric, error) {
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	var stressLabelParam any
	if stressLabel != "" {
		stressLabelParam = stressLabel
	}
	row := s.db.QueryRowContext(ctx, `
		INSERT INTO daily_metrics (id, user_id, metric_date, sleep_hours, stress_score, stress_label, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		ON CONFLICT (user_id, metric_date) DO UPDATE SET
			sleep_hours = COALESCE(EXCLUDED.sleep_hours, daily_metrics.sleep_hours),
			stress_score = COALESCE(EXCLUDED.stress_score, daily_metrics.stress_score),
			stress_label = COALESCE(EXCLUDED.stress_label, daily_metrics.stress_label),
			updated_at = NOW()
		RETURNING id, user_id, metric_date::text, sleep_hours, stress_score, COALESCE(stress_label, ''), updated_at
	`, newID(), userID, metricDate, sleepHours, stressScore, stressLabelParam)
	var metric DailyMetric
	if err := row.Scan(&metric.ID, &metric.UserID, &metric.MetricDate, &metric.SleepHours, &metric.StressScore, &metric.StressLabel, &metric.UpdatedAt); err != nil {
		return DailyMetric{}, fmt.Errorf("simpan metrik harian: %w", err)
	}
	return metric, nil
}

func (s *Store) dailyMetricsForUserLastWeekPostgres(userID string) ([]DailyMetric, error) {
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, user_id, metric_date::text, sleep_hours, stress_score, COALESCE(stress_label, ''), updated_at
		FROM daily_metrics
		WHERE user_id = $1 AND metric_date >= (CURRENT_DATE - INTERVAL '30 days')
		ORDER BY metric_date DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]DailyMetric, 0)
	for rows.Next() {
		var metric DailyMetric
		if err := rows.Scan(&metric.ID, &metric.UserID, &metric.MetricDate, &metric.SleepHours, &metric.StressScore, &metric.StressLabel, &metric.UpdatedAt); err != nil {
			return nil, err
		}
		result = append(result, metric)
	}
	return result, rows.Err()
}

func (s *Store) addDeclutterEntryPostgres(entry DeclutterEntry) (DeclutterEntry, error) {
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	_, err := s.db.ExecContext(ctx, `INSERT INTO cognitive_declutter_entries (id, user_id, content, tag, panic_level, overwhelm_level, share_with_psychologist, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, entry.ID, entry.UserID, entry.Content, entry.Tag, entry.PanicLevel, entry.OverwhelmLevel, entry.ShareWithPsychologist, entry.CreatedAt)
	if err != nil {
		return DeclutterEntry{}, fmt.Errorf("simpan catatan cognitive de-clutter: %w", err)
	}
	return entry, nil
}

func (s *Store) declutterEntriesForUserPostgres(userID string) ([]DeclutterEntry, error) {
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	rows, err := s.db.QueryContext(ctx, `SELECT id, user_id, content, tag, panic_level, overwhelm_level, share_with_psychologist, created_at FROM cognitive_declutter_entries WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]DeclutterEntry, 0)
	for rows.Next() {
		var entry DeclutterEntry
		if err := rows.Scan(&entry.ID, &entry.UserID, &entry.Content, &entry.Tag, &entry.PanicLevel, &entry.OverwhelmLevel, &entry.ShareWithPsychologist, &entry.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, entry)
	}
	return result, rows.Err()
}

func (s *Store) addTaskCompletionPostgres(completion TaskCompletion) (TaskCompletion, error) {
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	_, err := s.db.ExecContext(ctx, `INSERT INTO task_completions (id, user_id, xp, completed_at) VALUES ($1, $2, $3, $4)`, completion.ID, completion.UserID, completion.XP, completion.CompletedAt)
	if err != nil {
		return TaskCompletion{}, fmt.Errorf("simpan task completion: %w", err)
	}
	return completion, nil
}

func (s *Store) taskCompletionsForUserLastWeekPostgres(userID string) ([]TaskCompletion, error) {
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, user_id, xp, completed_at
		FROM task_completions
		WHERE user_id = $1 AND completed_at >= (NOW() - INTERVAL '6 days')
		ORDER BY completed_at ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]TaskCompletion, 0)
	for rows.Next() {
		var completion TaskCompletion
		if err := rows.Scan(&completion.ID, &completion.UserID, &completion.XP, &completion.CompletedAt); err != nil {
			return nil, err
		}
		result = append(result, completion)
	}
	return result, rows.Err()
}

func (s *Store) lifetimeXPForUserPostgres(userID string) (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	var total int
	err := s.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(xp), 0) FROM task_completions WHERE user_id = $1`, userID).Scan(&total)
	if err != nil {
		return 0, err
	}
	return total, nil
}
