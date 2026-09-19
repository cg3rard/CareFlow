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
	if createErr != nil && !strings.Contains(createErr.Error(), "sudah terdaftar") {
		return createErr
	}
	return nil
}

func (s *Store) createUserPostgres(name, email, passwordHash string) (User, string, error) {
	user := User{ID: newID(), Name: name, Email: email, PasswordHash: passwordHash, CreatedAt: time.Now().UTC()}
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	_, err := s.db.ExecContext(ctx, `INSERT INTO users (id, name, email, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)`, user.ID, user.Name, user.Email, user.PasswordHash, user.CreatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return User{}, "", errors.New("email sudah terdaftar")
		}
		return User{}, "", fmt.Errorf("simpan akun: %w", err)
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
	err := s.db.QueryRowContext(ctx, `SELECT id, name, email, password_hash, created_at FROM users WHERE email = $1`, email).Scan(&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return User{}, "", errors.New("email atau kata sandi salah")
		}
		return User{}, "", fmt.Errorf("ambil akun: %w", err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return User{}, "", errors.New("email atau kata sandi salah")
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
	err := s.db.QueryRowContext(ctx, `SELECT id, name, email, password_hash, created_at FROM users WHERE id = $1`, userID).Scan(&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.CreatedAt)
	return user, err == nil
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
