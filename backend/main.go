package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type Config struct {
	Port           string
	AppEnv         string
	GeminiAPIKey   string
	DataFile       string
	DatabaseURL    string
	DemoName       string
	DemoEmail      string
	DemoPassword   string
	FrontendOrigin string
}

type SliceRequest struct {
	Content    string `json:"content"`
	Tag        string `json:"tag"`
	PanicLevel int    `json:"panicLevel"`
}

type MicroTask struct {
	ID       string `json:"id"`
	Action   string `json:"action"`
	Duration string `json:"duration"`
	Guidance string `json:"guidance"`
}

type SliceResponse struct {
	Source      string      `json:"source"`
	Affirmation string      `json:"affirmation"`
	Tag         string      `json:"tag"`
	Tasks       []MicroTask `json:"tasks"`
}

type EmergencyResource struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Category     string `json:"category"`
	Phone        string `json:"phone"`
	Description  string `json:"description"`
	Availability string `json:"availability"`
	Location     string `json:"location"`
	Website      string `json:"website,omitempty"`
}

type User struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"passwordHash"`
	DateOfBirth  *string   `json:"dateOfBirth,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
}

type SessionRecord struct {
	ID                  string    `json:"id"`
	UserID              string    `json:"userId"`
	CreatedAt           time.Time `json:"createdAt"`
	Mood                string    `json:"mood"`
	Mascot              string    `json:"mascot"`
	CompletedTasksCount int       `json:"completedTasksCount"`
	TotalXP             int       `json:"totalXp"`
}

// DailyMetric captures one day's self-reported sleep duration and stress
// indicator for a user. There is at most one row per user per calendar day
// (upserted), which is what powers the last-7-day sleep/stress trend.
type DailyMetric struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	MetricDate  string    `json:"metricDate"`
	SleepHours  *float64  `json:"sleepHours,omitempty"`
	StressScore *int      `json:"stressScore,omitempty"`
	StressLabel string    `json:"stressLabel,omitempty"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// DeclutterEntry stores one cognitive de-clutter (brain-dump) submission.
type DeclutterEntry struct {
	ID                    string    `json:"id"`
	UserID                string    `json:"userId"`
	Content               string    `json:"content"`
	Tag                   string    `json:"tag"`
	PanicLevel            int       `json:"panicLevel"`
	OverwhelmLevel        string    `json:"overwhelmLevel"`
	ShareWithPsychologist bool      `json:"shareWithPsychologist"`
	CreatedAt             time.Time `json:"createdAt"`
}

// TaskCompletion records the real moment a Flow Studio micro-task was
// marked done, so the "Focus Activity" chart reflects genuine usage
// instead of mock data.
type TaskCompletion struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	XP          int       `json:"xp"`
	CompletedAt time.Time `json:"completedAt"`
}

type persistedData struct {
	Users            []User           `json:"users"`
	Sessions         []SessionRecord  `json:"sessions"`
	DailyMetrics     []DailyMetric    `json:"dailyMetrics"`
	DeclutterEntries []DeclutterEntry `json:"declutterEntries"`
	TaskCompletions  []TaskCompletion `json:"taskCompletions"`
}

type Store struct {
	mu               sync.RWMutex
	path             string
	db               *sql.DB
	users            []User
	sessions         []SessionRecord
	dailyMetrics     []DailyMetric
	declutterEntries []DeclutterEntry
	taskCompletions  []TaskCompletion
	tokens           map[string]string
}

type Credentials struct {
	Name        string `json:"name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	DateOfBirth string `json:"dateOfBirth,omitempty"`
}

type SessionInput struct {
	Mood                string `json:"mood"`
	Mascot              string `json:"mascot"`
	CompletedTasksCount int    `json:"completedTasksCount"`
	TotalXP             int    `json:"totalXp"`
}

// DailyMetricInput is the payload accepted by POST /api/metrics/daily.
// SleepHours and StressScore are pointers so the client can send just one of
// the two without overwriting the other for today's row.
type DailyMetricInput struct {
	SleepHours  *float64 `json:"sleepHours,omitempty"`
	StressScore *int     `json:"stressScore,omitempty"`
	StressLabel string   `json:"stressLabel,omitempty"`
}

// DeclutterInput is the payload accepted by POST /api/declutter.
type DeclutterInput struct {
	Content               string `json:"content"`
	Tag                   string `json:"tag"`
	PanicLevel            int    `json:"panicLevel"`
	ShareWithPsychologist bool   `json:"shareWithPsychologist,omitempty"`
}

// TaskCompletionInput is the payload accepted by POST /api/task-completions.
type TaskCompletionInput struct {
	XP int `json:"xp"`
}

type ProfileResponse struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Email       string          `json:"email"`
	DateOfBirth *string         `json:"dateOfBirth,omitempty"`
	StreakDays  int             `json:"streakDays"`
	LifetimeXP  int             `json:"lifetimeXp"`
	Sessions    []SessionRecord `json:"sessions,omitempty"`
}

func main() {
	loadEnvFile(".env")
	loadEnvFile("../.env")

	cfg := Config{
		Port:           getEnv("PORT", "8080"),
		AppEnv:         getEnv("APP_ENV", "development"),
		GeminiAPIKey:   getEnv("GEMINI_API_KEY", ""),
		DataFile:       getEnv("DATA_FILE", "data/careflow.json"),
		DatabaseURL:    getEnv("DATABASE_URL", ""),
		DemoName:       getEnv("DEMO_NAME", "Careflow Demo"),
		DemoEmail:      getEnv("DEMO_EMAIL", "demo@careflow.local"),
		DemoPassword:   getEnv("DEMO_PASSWORD", "CareflowDemo2026!"),
		FrontendOrigin: getEnv("FRONTEND_ORIGIN", "http://localhost:5173"),
	}
	var store *Store
	var err error
	if cfg.DatabaseURL != "" {
		store, err = newPostgresStore(cfg.DatabaseURL)
	} else {
		store, err = newStore(cfg.DataFile)
	}
	if err != nil {
		log.Fatalf("[Careflow Core] storage initialization failed: %v", err)
	}
	defer store.close()
	if err := ensureDemoAccount(store, cfg); err != nil {
		log.Fatalf("[Careflow Core] demo account initialization failed: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", handleHealth)
	mux.HandleFunc("GET /api/emergency/resources", handleEmergencyResources)
	mux.HandleFunc("POST /api/slice", handleTaskSlice(cfg))
	mux.HandleFunc("POST /api/auth/register", handleRegister(store))
	mux.HandleFunc("POST /api/auth/login", handleLogin(store))
	mux.HandleFunc("POST /api/auth/logout", handleLogout(store))
	mux.HandleFunc("GET /api/auth/me", handleMe(store))
	mux.HandleFunc("POST /api/sessions", handleCreateSession(store))
	mux.HandleFunc("GET /api/sessions", handleListSessions(store))
	mux.HandleFunc("POST /api/metrics/daily", handleUpsertDailyMetric(store))
	mux.HandleFunc("GET /api/metrics/daily", handleListDailyMetrics(store))
	mux.HandleFunc("POST /api/declutter", handleCreateDeclutterEntry(store))
	mux.HandleFunc("GET /api/declutter", handleListDeclutterEntries(store))
	mux.HandleFunc("POST /api/task-completions", handleCreateTaskCompletion(store))
	mux.HandleFunc("GET /api/task-completions", handleListTaskCompletions(store))

	serverAddr := ":" + cfg.Port
	log.Printf("[Careflow Core] listening on %s (%s)", serverAddr, cfg.AppEnv)
	if cfg.DatabaseURL != "" {
		log.Printf("[Careflow Core] PostgreSQL storage is active")
	} else {
		log.Printf("[Careflow Core] JSON fallback storage is active at %s", cfg.DataFile)
	}
	log.Printf("[Careflow Core] demo account ready: %s (%s)", cfg.DemoName, cfg.DemoEmail)
	if cfg.GeminiAPIKey == "" {
		log.Printf("[Careflow Core] AI disabled; deterministic offline slicer is active")
	}
	if err := http.ListenAndServe(serverAddr, enableCORS(mux, cfg.FrontendOrigin)); err != nil {
		log.Fatalf("[Careflow Core] server failed: %v", err)
	}
}

func newStore(path string) (*Store, error) {
	store := &Store{path: path, tokens: make(map[string]string)}
	contents, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return store, nil
	}
	if err != nil {
		return nil, err
	}
	var data persistedData
	if err := json.Unmarshal(contents, &data); err != nil {
		return nil, fmt.Errorf("read storage: %w", err)
	}
	store.users = data.Users
	store.sessions = data.Sessions
	store.dailyMetrics = data.DailyMetrics
	store.declutterEntries = data.DeclutterEntries
	store.taskCompletions = data.TaskCompletions
	return store, nil
}

func (s *Store) saveLocked() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0700); err != nil {
		return err
	}
	contents, err := json.MarshalIndent(persistedData{Users: s.users, Sessions: s.sessions, DailyMetrics: s.dailyMetrics, DeclutterEntries: s.declutterEntries, TaskCompletions: s.taskCompletions}, "", "  ")
	if err != nil {
		return err
	}
	tmpPath := s.path + ".tmp"
	if err := os.WriteFile(tmpPath, contents, 0600); err != nil {
		return err
	}
	return os.Rename(tmpPath, s.path)
}

// parseDateOfBirth validates an optional "YYYY-MM-DD" date string, rejecting
// dates in the future or implausibly far in the past.
func parseDateOfBirth(raw string) (*string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}
	parsed, err := time.Parse("2006-01-02", trimmed)
	if err != nil {
		return nil, errors.New("tanggal lahir tidak valid (gunakan format YYYY-MM-DD)")
	}
	now := time.Now().UTC()
	if parsed.After(now) {
		return nil, errors.New("tanggal lahir tidak boleh di masa depan")
	}
	if parsed.Before(now.AddDate(-150, 0, 0)) {
		return nil, errors.New("tanggal lahir tidak valid")
	}
	normalized := parsed.Format("2006-01-02")
	return &normalized, nil
}

func (s *Store) createUser(input Credentials) (User, string, error) {
	name := strings.TrimSpace(input.Name)
	email := strings.ToLower(strings.TrimSpace(input.Email))
	if len(name) < 2 || len(name) > 80 {
		return User{}, "", errors.New("nama harus terdiri dari 2 sampai 80 karakter")
	}
	if !strings.Contains(email, "@") || len(email) > 254 {
		return User{}, "", errors.New("email tidak valid")
	}
	if len(input.Password) < 8 || len(input.Password) > 128 {
		return User{}, "", errors.New("kata sandi harus terdiri dari 8 sampai 128 karakter")
	}
	dateOfBirth, err := parseDateOfBirth(input.DateOfBirth)
	if err != nil {
		return User{}, "", err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, "", err
	}
	if s.db != nil {
		return s.createUserPostgres(name, email, string(hash), dateOfBirth)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	for _, user := range s.users {
		if user.Email == email {
			return User{}, "", errors.New("email sudah terdaftar")
		}
	}
	user := User{ID: newID(), Name: name, Email: email, PasswordHash: string(hash), DateOfBirth: dateOfBirth, CreatedAt: time.Now().UTC()}
	s.users = append(s.users, user)
	if err := s.saveLocked(); err != nil {
		return User{}, "", err
	}
	token := s.createTokenLocked(user.ID)
	return user, token, nil
}

func (s *Store) login(email, password string) (User, string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if s.db != nil {
		return s.loginPostgres(email, password)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, user := range s.users {
		if user.Email != email {
			continue
		}
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
			return User{}, "", errors.New("email atau kata sandi salah")
		}
		return user, s.createTokenLocked(user.ID), nil
	}
	return User{}, "", errors.New("email atau kata sandi salah")
}

func (s *Store) createTokenLocked(userID string) string {
	token := randomHex(32)
	s.tokens[token] = userID
	return token
}

func (s *Store) userForToken(token string) (User, bool) {
	s.mu.RLock()
	userID, ok := s.tokens[token]
	s.mu.RUnlock()
	if !ok {
		return User{}, false
	}
	if s.db != nil {
		return s.userByIDPostgres(userID)
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, user := range s.users {
		if user.ID == userID {
			return user, true
		}
	}
	return User{}, false
}

func (s *Store) revokeToken(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.tokens, token)
}

func (s *Store) addSession(userID string, input SessionInput) (SessionRecord, error) {
	mood := strings.TrimSpace(input.Mood)
	mascot := strings.TrimSpace(input.Mascot)
	if mood == "" {
		mood = "Neutral"
	}
	if mascot == "" {
		mascot = "Gentle"
	}
	if input.CompletedTasksCount < 0 || input.CompletedTasksCount > 3 || input.TotalXP < 0 || input.TotalXP > 1000000 {
		return SessionRecord{}, errors.New("data sesi tidak valid")
	}
	record := SessionRecord{ID: newID(), UserID: userID, CreatedAt: time.Now().UTC(), Mood: mood, Mascot: mascot, CompletedTasksCount: input.CompletedTasksCount, TotalXP: input.TotalXP}
	if s.db != nil {
		return s.addSessionPostgres(record)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions = append(s.sessions, record)
	if err := s.saveLocked(); err != nil {
		return SessionRecord{}, err
	}
	return record, nil
}

func (s *Store) sessionsForUser(userID string) []SessionRecord {
	if s.db != nil {
		result, err := s.sessionsForUserPostgres(userID)
		if err != nil {
			log.Printf("[Careflow Core] read PostgreSQL sessions: %v", err)
			return []SessionRecord{}
		}
		return result
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]SessionRecord, 0)
	for _, record := range s.sessions {
		if record.UserID == userID {
			result = append(result, record)
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].CreatedAt.After(result[j].CreatedAt) })
	return result
}

// jakartaToday returns today's calendar date string ("YYYY-MM-DD") in the
// Asia/Jakarta timezone, matching the streak calculation convention.
func jakartaToday() string {
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		location = time.Local
	}
	return time.Now().In(location).Format("2006-01-02")
}

// upsertDailyMetric records (or updates) today's sleep/stress entry for a
// user. Passing a nil field leaves that column untouched on update.
func (s *Store) upsertDailyMetric(userID string, input DailyMetricInput) (DailyMetric, error) {
	if input.SleepHours != nil && (*input.SleepHours < 0 || *input.SleepHours > 24) {
		return DailyMetric{}, errors.New("durasi tidur tidak valid")
	}
	if input.StressScore != nil && (*input.StressScore < 0 || *input.StressScore > 100) {
		return DailyMetric{}, errors.New("skor stres tidak valid")
	}
	stressLabel := strings.TrimSpace(input.StressLabel)
	if len(stressLabel) > 40 {
		stressLabel = stressLabel[:40]
	}
	today := jakartaToday()
	if s.db != nil {
		return s.upsertDailyMetricPostgres(userID, today, input.SleepHours, input.StressScore, stressLabel)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	for i, metric := range s.dailyMetrics {
		if metric.UserID != userID || metric.MetricDate != today {
			continue
		}
		if input.SleepHours != nil {
			metric.SleepHours = input.SleepHours
		}
		if input.StressScore != nil {
			metric.StressScore = input.StressScore
		}
		if stressLabel != "" {
			metric.StressLabel = stressLabel
		}
		metric.UpdatedAt = time.Now().UTC()
		s.dailyMetrics[i] = metric
		if err := s.saveLocked(); err != nil {
			return DailyMetric{}, err
		}
		return metric, nil
	}
	metric := DailyMetric{ID: newID(), UserID: userID, MetricDate: today, SleepHours: input.SleepHours, StressScore: input.StressScore, StressLabel: stressLabel, UpdatedAt: time.Now().UTC()}
	s.dailyMetrics = append(s.dailyMetrics, metric)
	if err := s.saveLocked(); err != nil {
		return DailyMetric{}, err
	}
	return metric, nil
}

// dailyMetricsForUserLastWeek returns up to the last 7 calendar days of
// sleep/stress metrics for a user, newest first.
func (s *Store) dailyMetricsForUserLastWeek(userID string) []DailyMetric {
	if s.db != nil {
		result, err := s.dailyMetricsForUserLastWeekPostgres(userID)
		if err != nil {
			log.Printf("[Careflow Core] read PostgreSQL daily metrics: %v", err)
			return []DailyMetric{}
		}
		return result
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	cutoff := time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	result := make([]DailyMetric, 0)
	for _, metric := range s.dailyMetrics {
		if metric.UserID == userID && metric.MetricDate >= cutoff {
			result = append(result, metric)
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].MetricDate > result[j].MetricDate })
	return result
}

// addDeclutterEntry stores one cognitive de-clutter (brain-dump) submission.
func (s *Store) addDeclutterEntry(userID string, input DeclutterInput) (DeclutterEntry, error) {
	content := strings.TrimSpace(input.Content)
	tag := strings.TrimSpace(input.Tag)
	if content == "" {
		return DeclutterEntry{}, errors.New("isi catatan tidak boleh kosong")
	}
	if len(content) > 4000 {
		return DeclutterEntry{}, errors.New("isi catatan terlalu panjang")
	}
	if tag == "" {
		tag = "Umum"
	}
	if len(tag) > 80 {
		return DeclutterEntry{}, errors.New("tag tidak valid")
	}
	if input.PanicLevel < 1 || input.PanicLevel > 5 {
		return DeclutterEntry{}, errors.New("tingkat panik tidak valid")
	}
	charLength := len(content)
	overwhelmLevel := "Ringan"
	if charLength > 120 {
		overwhelmLevel = "Tinggi"
	} else if charLength > 40 {
		overwhelmLevel = "Sedang"
	}
	entry := DeclutterEntry{ID: newID(), UserID: userID, Content: content, Tag: tag, PanicLevel: input.PanicLevel, OverwhelmLevel: overwhelmLevel, ShareWithPsychologist: input.ShareWithPsychologist, CreatedAt: time.Now().UTC()}
	if s.db != nil {
		return s.addDeclutterEntryPostgres(entry)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.declutterEntries = append(s.declutterEntries, entry)
	if err := s.saveLocked(); err != nil {
		return DeclutterEntry{}, err
	}
	return entry, nil
}

func (s *Store) declutterEntriesForUser(userID string) []DeclutterEntry {
	if s.db != nil {
		result, err := s.declutterEntriesForUserPostgres(userID)
		if err != nil {
			log.Printf("[Careflow Core] read PostgreSQL declutter entries: %v", err)
			return []DeclutterEntry{}
		}
		return result
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]DeclutterEntry, 0)
	for _, entry := range s.declutterEntries {
		if entry.UserID == userID {
			result = append(result, entry)
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].CreatedAt.After(result[j].CreatedAt) })
	return result
}

// addTaskCompletion records the real moment a micro-task was completed.
func (s *Store) addTaskCompletion(userID string, input TaskCompletionInput) (TaskCompletion, error) {
	if input.XP < 0 || input.XP > 1000 {
		return TaskCompletion{}, errors.New("nilai XP tidak valid")
	}
	completion := TaskCompletion{ID: newID(), UserID: userID, XP: input.XP, CompletedAt: time.Now().UTC()}
	if s.db != nil {
		return s.addTaskCompletionPostgres(completion)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.taskCompletions = append(s.taskCompletions, completion)
	if err := s.saveLocked(); err != nil {
		return TaskCompletion{}, err
	}
	return completion, nil
}

// taskCompletionsForUserLastWeek returns up to the last 7 days of
// task-completion timestamps for a user, used to plot real focus activity.
func (s *Store) taskCompletionsForUserLastWeek(userID string) []TaskCompletion {
	if s.db != nil {
		result, err := s.taskCompletionsForUserLastWeekPostgres(userID)
		if err != nil {
			log.Printf("[Careflow Core] read PostgreSQL task completions: %v", err)
			return []TaskCompletion{}
		}
		return result
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	cutoff := time.Now().AddDate(0, 0, -6)
	result := make([]TaskCompletion, 0)
	for _, completion := range s.taskCompletions {
		if completion.UserID == userID && completion.CompletedAt.After(cutoff) {
			result = append(result, completion)
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].CompletedAt.Before(result[j].CompletedAt) })
	return result
}

// lifetimeXPForUser sums XP across every recorded task completion for a
// user (not just the last 7 days), so the Flow Studio level/XP badge is
// backed by a persistent, ever-growing total instead of a per-session
// counter that resets on reload.
func (s *Store) lifetimeXPForUser(userID string) int {
	if s.db != nil {
		total, err := s.lifetimeXPForUserPostgres(userID)
		if err != nil {
			log.Printf("[Careflow Core] read PostgreSQL lifetime XP: %v", err)
			return 0
		}
		return total
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	total := 0
	for _, completion := range s.taskCompletions {
		if completion.UserID == userID {
			total += completion.XP
		}
	}
	return total
}

func calculateStreak(records []SessionRecord) int {
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		location = time.Local
	}
	days := make(map[string]struct{})
	for _, record := range records {
		days[record.CreatedAt.In(location).Format("2006-01-02")] = struct{}{}
	}
	streak := 0
	for date := time.Now().In(location); ; date = date.AddDate(0, 0, -1) {
		if _, exists := days[date.Format("2006-01-02")]; !exists {
			break
		}
		streak++
	}
	return streak
}

func handleRegister(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var input Credentials
		if err := decodeJSON(w, r, &input); err != nil {
			return
		}
		user, token, err := store.createUser(input)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, authResponse(user, token, 0, 0))
	}
}

func handleLogin(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var input Credentials
		if err := decodeJSON(w, r, &input); err != nil {
			return
		}
		user, token, err := store.login(input.Email, input.Password)
		if err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, authResponse(user, token, calculateStreak(store.sessionsForUser(user.ID)), store.lifetimeXPForUser(user.ID)))
	}
}

func handleLogout(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, _, ok := authenticatedUser(r, store)
		if !ok {
			writeError(w, http.StatusUnauthorized, "sesi tidak valid")
			return
		}
		store.revokeToken(token)
		w.WriteHeader(http.StatusNoContent)
	}
}

func handleMe(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, user, ok := authenticatedUser(r, store)
		if !ok {
			writeError(w, http.StatusUnauthorized, "sesi tidak valid")
			return
		}
		writeJSON(w, http.StatusOK, profileResponse(user, store.sessionsForUser(user.ID), false, store.lifetimeXPForUser(user.ID)))
	}
}

func handleCreateSession(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, user, ok := authenticatedUser(r, store)
		if !ok {
			writeError(w, http.StatusUnauthorized, "silakan masuk terlebih dahulu")
			return
		}
		var input SessionInput
		if err := decodeJSON(w, r, &input); err != nil {
			return
		}
		record, err := store.addSession(user.ID, input)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, record)
	}
}

func handleListSessions(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, user, ok := authenticatedUser(r, store)
		if !ok {
			writeError(w, http.StatusUnauthorized, "silakan masuk terlebih dahulu")
			return
		}
		writeJSON(w, http.StatusOK, profileResponse(user, store.sessionsForUser(user.ID), true, store.lifetimeXPForUser(user.ID)))
	}
}

func handleUpsertDailyMetric(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, user, ok := authenticatedUser(r, store)
		if !ok {
			writeError(w, http.StatusUnauthorized, "silakan masuk terlebih dahulu")
			return
		}
		var input DailyMetricInput
		if err := decodeJSON(w, r, &input); err != nil {
			return
		}
		metric, err := store.upsertDailyMetric(user.ID, input)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, metric)
	}
}

func handleListDailyMetrics(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, user, ok := authenticatedUser(r, store)
		if !ok {
			writeError(w, http.StatusUnauthorized, "silakan masuk terlebih dahulu")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"metrics": store.dailyMetricsForUserLastWeek(user.ID)})
	}
}

func handleCreateDeclutterEntry(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, user, ok := authenticatedUser(r, store)
		if !ok {
			writeError(w, http.StatusUnauthorized, "silakan masuk terlebih dahulu")
			return
		}
		var input DeclutterInput
		if err := decodeJSON(w, r, &input); err != nil {
			return
		}
		entry, err := store.addDeclutterEntry(user.ID, input)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, entry)
	}
}

func handleListDeclutterEntries(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, user, ok := authenticatedUser(r, store)
		if !ok {
			writeError(w, http.StatusUnauthorized, "silakan masuk terlebih dahulu")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"entries": store.declutterEntriesForUser(user.ID)})
	}
}

func handleCreateTaskCompletion(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, user, ok := authenticatedUser(r, store)
		if !ok {
			writeError(w, http.StatusUnauthorized, "silakan masuk terlebih dahulu")
			return
		}
		var input TaskCompletionInput
		if err := decodeJSON(w, r, &input); err != nil {
			return
		}
		completion, err := store.addTaskCompletion(user.ID, input)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, completion)
	}
}

func handleListTaskCompletions(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, user, ok := authenticatedUser(r, store)
		if !ok {
			writeError(w, http.StatusUnauthorized, "silakan masuk terlebih dahulu")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"completions": store.taskCompletionsForUserLastWeek(user.ID)})
	}
}

func authResponse(user User, token string, streak int, lifetimeXP int) map[string]any {
	profile := profileResponse(user, nil, false, lifetimeXP)
	profile.StreakDays = streak
	return map[string]any{"token": token, "user": profile, "streakDays": streak}
}

func profileResponse(user User, records []SessionRecord, includeSessions bool, lifetimeXP int) ProfileResponse {
	response := ProfileResponse{ID: user.ID, Name: user.Name, Email: user.Email, DateOfBirth: user.DateOfBirth, StreakDays: calculateStreak(records), LifetimeXP: lifetimeXP}
	if includeSessions {
		response.Sessions = records
	}
	return response
}

func authenticatedUser(r *http.Request, store *Store) (string, User, bool) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return "", User{}, false
	}
	token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	user, ok := store.userForToken(token)
	return token, user, ok
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"status": "healthy", "service": "Careflow Core API", "timestamp": time.Now().UTC().Format(time.RFC3339)})
}

func handleEmergencyResources(w http.ResponseWriter, r *http.Request) {
	resources := []EmergencyResource{
		{ID: "hotline-sejiwa", Name: "Layanan Sejiwa (Kemenkes & HIMSPSI)", Category: "National Hotline", Phone: "119 ext 8", Description: "Layanan konseling psikologis darurat resmi pemerintah untuk masyarakat Indonesia yang mengalami krisis emosional.", Availability: "Periksa ketersediaan layanan terbaru", Location: "Nasional", Website: "https://kemkes.go.id"},
		{ID: "hotline-kemenkes", Name: "Hotline Kesehatan Kemenkes RI", Category: "National Hotline", Phone: "1500-567", Description: "Pusat panggilan layanan kesehatan Kementerian Kesehatan RI.", Availability: "Periksa ketersediaan layanan terbaru", Location: "Nasional", Website: "https://kemkes.go.id"},
		{ID: "hotline-lisa", Name: "Love Inside Suicide Awareness (LISA)", Category: "National Hotline", Phone: "0811-3855-472", Description: "Dukungan pencegahan bunuh diri dan konseling krisis bilingual.", Availability: "Periksa ketersediaan layanan terbaru", Location: "Nasional", Website: "https://www.lisahelpline.org"},
		{ID: "campus-unjani-yk", Name: "Pusat Konseling Mahasiswa UNJANI Yogyakarta", Category: "Campus Counseling", Phone: "(0274) 4342000", Description: "Layanan bimbingan konseling akademik dan kesehatan mental untuk sivitas UNJANI Yogyakarta.", Availability: "Senin–Jumat, jam kerja", Location: "Sleman, D.I. Yogyakarta", Website: "https://unjaya.ac.id"},
		{ID: "campus-ugm", Name: "Gadjah Mada Medical Center & Konseling UGM", Category: "Campus Counseling", Phone: "(0274) 551412", Description: "Layanan psikolog klinis dan konseling mahasiswa terpadu UGM.", Availability: "Senin–Jumat, jam kerja", Location: "Yogyakarta", Website: "https://gmc.ugm.ac.id"},
	}
	writeJSON(w, http.StatusOK, resources)
}

func handleTaskSlice(cfg Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req SliceRequest
		if err := decodeJSON(w, r, &req); err != nil {
			return
		}
		content := strings.TrimSpace(req.Content)
		if content == "" {
			content = "Tugas kuliah yang terasa menumpuk dan mendesak"
		}
		tag := strings.TrimSpace(req.Tag)
		if tag == "" {
			tag = "Deadline"
		}
		panicLevel := req.PanicLevel
		if panicLevel < 1 || panicLevel > 5 {
			panicLevel = 3
		}
		if cfg.GeminiAPIKey != "" {
			ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
			defer cancel()
			result, err := callGeminiSlice(ctx, cfg.GeminiAPIKey, content, tag, panicLevel)
			if err != nil {
				log.Printf("[Careflow Core] Gemini slice request failed, falling back to heuristic engine: %v", err)
			} else if len(result.Tasks) >= 3 {
				writeJSON(w, http.StatusOK, result)
				return
			}
		}
		writeJSON(w, http.StatusOK, generateHeuristicSlice(content, tag, panicLevel))
	}
}

func callGeminiSlice(ctx context.Context, apiKey, content, tag string, panicLevel int) (*SliceResponse, error) {
	prompt := fmt.Sprintf(`Kamu adalah teman yang santai dan suportif, bukan terapis formal. Buat TEPAT tiga langkah mikro CBT yang aman untuk meredakan overthinking, dalam Bahasa Indonesia sehari-hari yang hangat dan friendly.

Aturan penting:
- "action" harus SANGAT SINGKAT: maksimal 5-7 kata, seperti judul aksi, bukan kalimat penuh. Contoh: "Tarik napas 3x pelan-pelan" atau "Tulis 1 kalimat aja dulu".
- "guidance" maksimal 1 kalimat pendek, santai, tanpa jargon psikologi.
- "affirmation" 1 kalimat pendek, hangat, dan friendly.
- Setiap langkah harus bisa selesai di bawah 5 menit.
- JANGAN gunakan emoji atau simbol non-teks apa pun.
- JANGAN bertele-tele atau memberi ceramah panjang.

Kembalikan HANYA JSON ini: {"affirmation":"...","tasks":[{"id":"task-1","action":"...","duration":"2 menit","guidance":"..."}]}.

Beban: %q. Kategori: %q. Tingkat panik: %d/5.`, content, tag, panicLevel)
	payload, err := json.Marshal(map[string]any{"contents": []map[string]any{{"parts": []map[string]string{{"text": prompt}}}}, "generationConfig": map[string]any{"temperature": 0.4, "responseMimeType": "application/json"}})
	if err != nil {
		return nil, err
	}
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=%s", apiKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 18 * time.Second}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		errorBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("gemini returned %d: %s", resp.StatusCode, string(errorBody))
	}
	var body struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil || len(body.Candidates) == 0 || len(body.Candidates[0].Content.Parts) == 0 {
		return nil, errors.New("invalid Gemini response")
	}
	raw := strings.Trim(strings.TrimSpace(body.Candidates[0].Content.Parts[0].Text), "`")
	raw = strings.TrimSpace(strings.TrimPrefix(raw, "json"))
	var parsed struct {
		Affirmation string      `json:"affirmation"`
		Tasks       []MicroTask `json:"tasks"`
	}
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, err
	}
	return &SliceResponse{Source: "gemini-ai", Affirmation: parsed.Affirmation, Tag: tag, Tasks: parsed.Tasks}, nil
}

func generateHeuristicSlice(content, tag string, panicLevel int) SliceResponse {
	text := strings.ToLower(content + " " + tag)
	affirmation := "Tarik napas perlahan. Kamu tidak harus menyelesaikan semuanya hari ini; cukup mulai dari satu sentuhan kecil."
	if panicLevel >= 4 {
		affirmation = "Detak jantungmu mungkin sedang tinggi. Mari tenangkan tubuh dulu, lalu uraikan satu langkah kecil."
	}
	var tasks []MicroTask
	switch {
	case strings.Contains(text, "skripsi") || strings.Contains(text, "proposal"):
		tasks = taskSet("Buka dokumen dan tulis satu judul subbab", "Buka satu referensi lalu sorot dua kalimat penting", "Rangkum kutipan itu menjadi dua kalimat dengan bahasamu sendiri")
	case strings.Contains(text, "ujian") || strings.Contains(text, "kuis"):
		tasks = taskSet("Pilih satu topik paling familier dari silabus", "Tulis tiga istilah atau rumus inti di kertas", "Baca pembahasan satu contoh soal saja")
	case strings.Contains(text, "presentasi") || strings.Contains(text, "ppt"):
		tasks = taskSet("Buka presentasi dan buat slide judul", "Tulis tiga poin bahasan kasar di slide kedua", "Tambahkan satu visual pendukung di slide ketiga")
	case strings.Contains(text, "koding") || strings.Contains(text, "coding") || strings.Contains(text, "bug"):
		tasks = taskSet("Buka file terkait dan tulis satu komentar TODO", "Tambahkan satu log/debugger di titik masuk data", "Ubah satu hal kecil lalu jalankan program sekali")
	default:
		tasks = taskSet("Buka folder tugas dan singkirkan dua benda pengalih", "Tulis satu langkah termudah yang selesai dalam tiga menit", "Kerjakan langkah kecil itu lalu beri tanda centang")
	}
	return SliceResponse{Source: "heuristic_engine", Affirmation: affirmation, Tag: tag, Tasks: tasks}
}

func taskSet(first, second, third string) []MicroTask {
	return []MicroTask{
		{ID: "task-1", Action: first, Duration: "2 menit", Guidance: "Cukup mulai; hasilnya belum harus rapi."},
		{ID: "task-2", Action: second, Duration: "3 menit", Guidance: "Fokus pada satu hal kecil tanpa mengejar kesempurnaan."},
		{ID: "task-3", Action: third, Duration: "4 menit", Guidance: "Satu langkah selesai sudah cukup untuk membangun momentum."},
	}
}

func enableCORS(next http.Handler, allowedOrigin string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && origin == allowedOrigin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		writeError(w, http.StatusBadRequest, "format data tidak valid")
		return err
	}
	if decoder.Decode(&struct{}{}) != io.EOF {
		writeError(w, http.StatusBadRequest, "hanya satu objek JSON yang diperbolehkan")
		return errors.New("multiple JSON values")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func randomHex(byteCount int) string {
	bytes := make([]byte, byteCount)
	if _, err := rand.Read(bytes); err != nil {
		panic("secure random generator unavailable")
	}
	return hex.EncodeToString(bytes)
}

func newID() string { return randomHex(16) }

func loadEnvFile(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 && os.Getenv(strings.TrimSpace(parts[0])) == "" {
			_ = os.Setenv(strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]))
		}
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
