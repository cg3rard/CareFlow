package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"
)

const (
	roleAdmin        = "admin"
	rolePsychologist = "psychologist"
	roleUser         = "user"
)

type UserUpdateInput struct {
	Name     *string `json:"name,omitempty"`
	Role     *string `json:"role,omitempty"`
	IsBanned *bool   `json:"isBanned,omitempty"`
}

type AdminCreateUserInput struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type PsychologistSelectionInput struct {
	PsychologistID            string `json:"psychologistId"`
	ShareDataWithPsychologist bool   `json:"shareDataWithPsychologist"`
}

type ChatMessage struct {
	ID          string    `json:"id"`
	SenderID    string    `json:"senderId"`
	RecipientID string    `json:"recipientId"`
	Content     string    `json:"content"`
	CreatedAt   time.Time `json:"createdAt"`
}

type ChatInput struct {
	RecipientID string `json:"recipientId"`
	Content     string `json:"content"`
}

type ClientCareData struct {
	User                      ProfileResponse  `json:"user"`
	ShareDataWithPsychologist bool             `json:"shareDataWithPsychologist"`
	Sessions                  []SessionRecord  `json:"sessions"`
	DailyMetrics              []DailyMetric    `json:"dailyMetrics"`
	DeclutterEntries          []DeclutterEntry `json:"declutterEntries"`
}

func normalizedRole(role string) string {
	switch role {
	case roleAdmin, rolePsychologist, roleUser:
		return role
	default:
		return roleUser
	}
}

func (s *Store) ensureRoleSupport() error {
	if s.db == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	_, err := s.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS user_access (
			user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'psychologist', 'user')),
			is_banned BOOLEAN NOT NULL DEFAULT FALSE,
			psychologist_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			share_data_with_psychologist BOOLEAN NOT NULL DEFAULT FALSE,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS user_access_psychologist_idx ON user_access (psychologist_id);
		CREATE TABLE IF NOT EXISTS chat_messages (
			id TEXT PRIMARY KEY,
			sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			content TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS chat_messages_pair_idx ON chat_messages (sender_id, recipient_id, created_at ASC);
	`)
	return err
}

func (s *Store) hydrateAccess(user *User) {
	if user == nil {
		return
	}
	if s.db == nil {
		s.mu.RLock()
		defer s.mu.RUnlock()
		for _, item := range s.users {
			if item.ID == user.ID {
				user.Role = normalizedRole(item.Role)
				user.IsBanned = item.IsBanned
				user.PsychologistID = item.PsychologistID
				user.ShareDataWithPsychologist = item.ShareDataWithPsychologist
				return
			}
		}
		user.Role = roleUser
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
	defer cancel()
	var role string
	var banned, share bool
	var psychologistID sql.NullString
	err := s.db.QueryRowContext(ctx, `SELECT role, is_banned, psychologist_id, share_data_with_psychologist FROM user_access WHERE user_id=$1`, user.ID).Scan(&role, &banned, &psychologistID, &share)
	if err != nil {
		user.Role = roleUser
		return
	}
	user.Role, user.IsBanned, user.ShareDataWithPsychologist = normalizedRole(role), banned, share
	if psychologistID.Valid {
		user.PsychologistID = psychologistID.String
	}
}

func (s *Store) findUserByID(id string) (User, bool) {
	if s.db != nil {
		user, ok := s.userByIDPostgres(id)
		if ok {
			s.hydrateAccess(&user)
		}
		return user, ok
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, user := range s.users {
		if user.ID == id {
			user.Role = normalizedRole(user.Role)
			return user, true
		}
	}
	return User{}, false
}

func (s *Store) findUserByEmail(email string) (User, bool) {
	email = strings.ToLower(strings.TrimSpace(email))
	if s.db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
		defer cancel()
		var user User
		var dob sql.NullString
		err := s.db.QueryRowContext(ctx, `SELECT id,name,email,password_hash,date_of_birth::text,created_at FROM users WHERE email=$1`, email).Scan(&user.ID, &user.Name, &user.Email, &user.PasswordHash, &dob, &user.CreatedAt)
		if err != nil {
			return User{}, false
		}
		if dob.Valid {
			user.DateOfBirth = &dob.String
		}
		s.hydrateAccess(&user)
		return user, true
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, user := range s.users {
		if user.Email == email {
			user.Role = normalizedRole(user.Role)
			return user, true
		}
	}
	return User{}, false
}

func (s *Store) setUserAccess(userID, role string, banned bool, psychologistID string, share bool) error {
	role = normalizedRole(role)
	if s.db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
		defer cancel()
		_, err := s.db.ExecContext(ctx, `INSERT INTO user_access (user_id,role,is_banned,psychologist_id,share_data_with_psychologist,updated_at) VALUES ($1,$2,$3,NULLIF($4,''),$5,NOW()) ON CONFLICT (user_id) DO UPDATE SET role=EXCLUDED.role,is_banned=EXCLUDED.is_banned,psychologist_id=EXCLUDED.psychologist_id,share_data_with_psychologist=EXCLUDED.share_data_with_psychologist,updated_at=NOW()`, userID, role, banned, psychologistID, share)
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.users {
		if s.users[i].ID == userID {
			s.users[i].Role = role
			s.users[i].IsBanned = banned
			s.users[i].PsychologistID = psychologistID
			s.users[i].ShareDataWithPsychologist = share
			return s.saveLocked()
		}
	}
	return errors.New("user not found")
}

func userProfile(user User, store *Store) ProfileResponse {
	store.hydrateAccess(&user)
	profile := profileResponse(user, store.sessionsForUser(user.ID), false, store.lifetimeXPForUser(user.ID))
	if user.PsychologistID != "" {
		if psychologist, ok := store.findUserByID(user.PsychologistID); ok {
			profile.PsychologistName = psychologist.Name
		}
	}
	return profile
}

func (s *Store) listPsychologists() ([]ProfileResponse, error) {
	if s.db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
		defer cancel()
		rows, err := s.db.QueryContext(ctx, `SELECT u.id,u.name,u.email,u.password_hash,u.date_of_birth::text,u.created_at FROM users u JOIN user_access a ON a.user_id=u.id WHERE a.role='psychologist' AND a.is_banned=FALSE ORDER BY u.name`)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		result := []ProfileResponse{}
		for rows.Next() {
			var u User
			var dob sql.NullString
			if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &dob, &u.CreatedAt); err != nil {
				return nil, err
			}
			if dob.Valid {
				u.DateOfBirth = &dob.String
			}
			s.hydrateAccess(&u)
			result = append(result, userProfile(u, s))
		}
		return result, rows.Err()
	}
	s.mu.RLock()
	users := append([]User(nil), s.users...)
	s.mu.RUnlock()
	result := []ProfileResponse{}
	for _, u := range users {
		if normalizedRole(u.Role) == rolePsychologist && !u.IsBanned {
			result = append(result, userProfile(u, s))
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Name < result[j].Name })
	return result, nil
}

func (s *Store) disconnectPsychologist(userID string) error {
	user, ok := s.findUserByID(userID)
	if !ok {
		return errors.New("user not found")
	}
	if normalizedRole(user.Role) != roleUser {
		return errors.New("only user accounts can disconnect from a consultant")
	}
	if user.PsychologistID == "" {
		return errors.New("no consultant is currently connected")
	}
	return s.setUserAccess(user.ID, roleUser, user.IsBanned, "", false)
}

func (s *Store) selectPsychologist(userID, psychologistID string, share bool) error {
	user, ok := s.findUserByID(userID)
	if !ok {
		return errors.New("user not found")
	}
	if normalizedRole(user.Role) != roleUser {
		return errors.New("only user accounts can select a psychologist")
	}
	if user.PsychologistID != "" && user.PsychologistID != psychologistID {
		return errors.New("consultant is already locked in; contact an admin to change it")
	}
	psychologist, ok := s.findUserByID(psychologistID)
	if !ok || normalizedRole(psychologist.Role) != rolePsychologist || psychologist.IsBanned {
		return errors.New("psychologist is not available")
	}
	return s.setUserAccess(user.ID, roleUser, user.IsBanned, psychologist.ID, share)
}

func (s *Store) listPsychologistClients(psychologistID string) ([]ProfileResponse, error) {
	if s.db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
		defer cancel()
		rows, err := s.db.QueryContext(ctx, `SELECT u.id,u.name,u.email,u.password_hash,u.date_of_birth::text,u.created_at FROM users u JOIN user_access a ON a.user_id=u.id WHERE a.psychologist_id=$1 AND a.role='user' AND a.is_banned=FALSE ORDER BY u.name`, psychologistID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		result := []ProfileResponse{}
		for rows.Next() {
			var u User
			var dob sql.NullString
			if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &dob, &u.CreatedAt); err != nil {
				return nil, err
			}
			if dob.Valid {
				u.DateOfBirth = &dob.String
			}
			s.hydrateAccess(&u)
			result = append(result, userProfile(u, s))
		}
		return result, rows.Err()
	}
	s.mu.RLock()
	users := append([]User(nil), s.users...)
	s.mu.RUnlock()
	result := []ProfileResponse{}
	for _, u := range users {
		if normalizedRole(u.Role) == roleUser && u.PsychologistID == psychologistID && !u.IsBanned {
			result = append(result, userProfile(u, s))
		}
	}
	return result, nil
}

func (s *Store) clientCareData(psychologistID, clientID string) (ClientCareData, error) {
	client, ok := s.findUserByID(clientID)
	if !ok || normalizedRole(client.Role) != roleUser || client.PsychologistID != psychologistID {
		return ClientCareData{}, errors.New("client is not assigned to this psychologist")
	}
	data := ClientCareData{User: userProfile(client, s), ShareDataWithPsychologist: client.ShareDataWithPsychologist, Sessions: []SessionRecord{}, DailyMetrics: []DailyMetric{}, DeclutterEntries: []DeclutterEntry{}}
	if !client.ShareDataWithPsychologist {
		return data, nil
	}
	data.Sessions = s.sessionsForUser(clientID)
	data.DailyMetrics = s.dailyMetricsForUserLastWeek(clientID)
	for _, entry := range s.declutterEntriesForUser(clientID) {
		if entry.ShareWithPsychologist {
			data.DeclutterEntries = append(data.DeclutterEntries, entry)
		}
	}
	return data, nil
}

func (s *Store) listAdminUsers() ([]ProfileResponse, error) {
	if s.db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
		defer cancel()
		rows, err := s.db.QueryContext(ctx, `SELECT u.id,u.name,u.email,u.password_hash,u.date_of_birth::text,u.created_at FROM users u ORDER BY u.created_at DESC`)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		result := []ProfileResponse{}
		for rows.Next() {
			var u User
			var dob sql.NullString
			if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &dob, &u.CreatedAt); err != nil {
				return nil, err
			}
			if dob.Valid {
				u.DateOfBirth = &dob.String
			}
			s.hydrateAccess(&u)
			result = append(result, userProfile(u, s))
		}
		return result, rows.Err()
	}
	s.mu.RLock()
	users := append([]User(nil), s.users...)
	s.mu.RUnlock()
	result := make([]ProfileResponse, 0, len(users))
	for _, u := range users {
		result = append(result, userProfile(u, s))
	}
	return result, nil
}

func (s *Store) adminCreateUser(input AdminCreateUserInput) (ProfileResponse, error) {
	role := normalizedRole(input.Role)
	user, token, err := s.createUser(Credentials{Name: input.Name, Email: input.Email, Password: input.Password})
	if err != nil {
		return ProfileResponse{}, err
	}
	s.revokeToken(token)
	if err := s.setUserAccess(user.ID, role, false, "", false); err != nil {
		return ProfileResponse{}, err
	}
	created, ok := s.findUserByID(user.ID)
	if !ok {
		return ProfileResponse{}, errors.New("newly created account not found")
	}
	return userProfile(created, s), nil
}

func (s *Store) updateAdminUser(actorID, targetID string, input UserUpdateInput) (ProfileResponse, error) {
	if actorID == targetID && ((input.Role != nil && normalizedRole(*input.Role) != roleAdmin) || (input.IsBanned != nil && *input.IsBanned)) {
		return ProfileResponse{}, errors.New("an admin cannot demote or ban themselves")
	}
	target, ok := s.findUserByID(targetID)
	if !ok {
		return ProfileResponse{}, errors.New("user not found")
	}
	role, banned, psychologistID, share := normalizedRole(target.Role), target.IsBanned, target.PsychologistID, target.ShareDataWithPsychologist
	if input.Role != nil {
		role = normalizedRole(*input.Role)
		if role != roleUser {
			psychologistID = ""
			share = false
		}
	}
	if input.IsBanned != nil {
		banned = *input.IsBanned
	}
	if input.Name != nil {
		next := strings.TrimSpace(*input.Name)
		if len(next) < 2 || len(next) > 80 {
			return ProfileResponse{}, errors.New("name must be between 2 and 80 characters")
		}
		if s.db != nil {
			ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
			defer cancel()
			if _, err := s.db.ExecContext(ctx, `UPDATE users SET name=$1 WHERE id=$2`, next, targetID); err != nil {
				return ProfileResponse{}, fmt.Errorf("update name: %w", err)
			}
		} else {
			s.mu.Lock()
			for i := range s.users {
				if s.users[i].ID == targetID {
					s.users[i].Name = next
					break
				}
			}
			if err := s.saveLocked(); err != nil {
				s.mu.Unlock()
				return ProfileResponse{}, err
			}
			s.mu.Unlock()
		}
	}
	if err := s.setUserAccess(targetID, role, banned, psychologistID, share); err != nil {
		return ProfileResponse{}, err
	}
	updated, _ := s.findUserByID(targetID)
	return userProfile(updated, s), nil
}

func (s *Store) canChat(sender, recipient User) bool {
	sender.Role = normalizedRole(sender.Role)
	recipient.Role = normalizedRole(recipient.Role)
	return (sender.Role == roleUser && sender.PsychologistID == recipient.ID && recipient.Role == rolePsychologist) || (sender.Role == rolePsychologist && recipient.Role == roleUser && recipient.PsychologistID == sender.ID)
}
func (s *Store) addChatMessage(senderID string, input ChatInput) (ChatMessage, error) {
	sender, ok := s.findUserByID(senderID)
	if !ok {
		return ChatMessage{}, errors.New("sender not found")
	}
	recipient, ok := s.findUserByID(input.RecipientID)
	if !ok || !s.canChat(sender, recipient) {
		return ChatMessage{}, errors.New("chat is not allowed for this relationship")
	}
	content := strings.TrimSpace(input.Content)
	if content == "" || len(content) > 2000 {
		return ChatMessage{}, errors.New("message must be between 1 and 2000 characters")
	}
	item := ChatMessage{ID: newID(), SenderID: sender.ID, RecipientID: recipient.ID, Content: content, CreatedAt: time.Now().UTC()}
	if s.db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
		defer cancel()
		_, err := s.db.ExecContext(ctx, `INSERT INTO chat_messages (id,sender_id,recipient_id,content,created_at) VALUES ($1,$2,$3,$4,$5)`, item.ID, item.SenderID, item.RecipientID, item.Content, item.CreatedAt)
		if err != nil {
			return ChatMessage{}, err
		}
		return item, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.chatMessages = append(s.chatMessages, item)
	if err := s.saveLocked(); err != nil {
		return ChatMessage{}, err
	}
	return item, nil
}
func (s *Store) chatBetween(senderID, otherID string) ([]ChatMessage, error) {
	sender, ok := s.findUserByID(senderID)
	if !ok {
		return nil, errors.New("user not found")
	}
	other, ok := s.findUserByID(otherID)
	if !ok || !s.canChat(sender, other) {
		return nil, errors.New("chat is not allowed for this relationship")
	}
	if s.db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), databaseTimeout)
		defer cancel()
		rows, err := s.db.QueryContext(ctx, `SELECT id,sender_id,recipient_id,content,created_at FROM chat_messages WHERE (sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1) ORDER BY created_at ASC`, senderID, otherID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		result := []ChatMessage{}
		for rows.Next() {
			var item ChatMessage
			if err := rows.Scan(&item.ID, &item.SenderID, &item.RecipientID, &item.Content, &item.CreatedAt); err != nil {
				return nil, err
			}
			result = append(result, item)
		}
		return result, rows.Err()
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := []ChatMessage{}
	for _, item := range s.chatMessages {
		if (item.SenderID == senderID && item.RecipientID == otherID) || (item.SenderID == otherID && item.RecipientID == senderID) {
			result = append(result, item)
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].CreatedAt.Before(result[j].CreatedAt) })
	return result, nil
}

func chatHistoryLocation() *time.Location {
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		return time.Local
	}
	return location
}

func chatHistoryDate(createdAt time.Time) string {
	return createdAt.In(chatHistoryLocation()).Format("2006-01-02")
}

func chatHistoryDates(items []ChatMessage) []string {
	known := make(map[string]struct{})
	for _, item := range items {
		known[chatHistoryDate(item.CreatedAt)] = struct{}{}
	}
	dates := make([]string, 0, len(known))
	for date := range known {
		dates = append(dates, date)
	}
	sort.Slice(dates, func(i, j int) bool { return dates[i] > dates[j] })
	return dates
}

func chatMessagesForDate(items []ChatMessage, date string) []ChatMessage {
	if date == "" {
		return items
	}
	filtered := make([]ChatMessage, 0)
	for _, item := range items {
		if chatHistoryDate(item.CreatedAt) == date {
			filtered = append(filtered, item)
		}
	}
	return filtered
}

func chatMessagesForUserWindow(items []ChatMessage) []ChatMessage {
	location := chatHistoryLocation()
	now := time.Now().In(location)
	// Today plus the two preceding calendar days is the user's three-day view.
	start := time.Date(now.Year(), now.Month(), now.Day()-2, 0, 0, 0, 0, location)
	filtered := make([]ChatMessage, 0)
	for _, item := range items {
		if !item.CreatedAt.In(location).Before(start) {
			filtered = append(filtered, item)
		}
	}
	return filtered
}

func requireRole(r *http.Request, store *Store, role string) (User, bool) {
	_, user, ok := authenticatedUser(r, store)
	return user, ok && normalizedRole(user.Role) == role
}
func handleListPsychologists(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, _, ok := authenticatedUser(r, store); !ok {
			writeError(w, http.StatusUnauthorized, "please log in first")
			return
		}
		items, err := store.listPsychologists()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load psychologists")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"psychologists": items})
	}
}
func handleSelectPsychologist(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, user, ok := authenticatedUser(r, store)
		if !ok {
			writeError(w, http.StatusUnauthorized, "please log in first")
			return
		}
		var input PsychologistSelectionInput
		if decodeJSON(w, r, &input) != nil {
			return
		}
		if err := store.selectPsychologist(user.ID, input.PsychologistID, input.ShareDataWithPsychologist); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		updated, _ := store.findUserByID(user.ID)
		writeJSON(w, http.StatusOK, userProfile(updated, store))
	}
}
func handleDisconnectPsychologist(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, user, ok := authenticatedUser(r, store)
		if !ok {
			writeError(w, http.StatusUnauthorized, "please log in first")
			return
		}
		if err := store.disconnectPsychologist(user.ID); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		updated, _ := store.findUserByID(user.ID)
		writeJSON(w, http.StatusOK, userProfile(updated, store))
	}
}

func handlePsychologistClients(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireRole(r, store, rolePsychologist)
		if !ok {
			writeError(w, http.StatusForbidden, "psychologist accounts only")
			return
		}
		items, err := store.listPsychologistClients(user.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load clients")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"clients": items})
	}
}
func handlePsychologistClientData(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireRole(r, store, rolePsychologist)
		if !ok {
			writeError(w, http.StatusForbidden, "psychologist accounts only")
			return
		}
		id := strings.TrimPrefix(r.URL.Path, "/api/psychologist/clients/")
		data, err := store.clientCareData(user.ID, id)
		if err != nil {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, data)
	}
}
func handleAdminUsers(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := requireRole(r, store, roleAdmin); !ok {
			writeError(w, http.StatusForbidden, "admin only")
			return
		}
		items, err := store.listAdminUsers()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load users")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"users": items})
	}
}
func handleAdminCreateUser(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := requireRole(r, store, roleAdmin); !ok {
			writeError(w, http.StatusForbidden, "admin only")
			return
		}
		var input AdminCreateUserInput
		if decodeJSON(w, r, &input) != nil {
			return
		}
		user, err := store.adminCreateUser(input)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, user)
	}
}

func handleAdminUserUpdate(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor, ok := requireRole(r, store, roleAdmin)
		if !ok {
			writeError(w, http.StatusForbidden, "admin only")
			return
		}
		id := strings.TrimPrefix(r.URL.Path, "/api/admin/users/")
		var input UserUpdateInput
		if decodeJSON(w, r, &input) != nil {
			return
		}
		user, err := store.updateAdminUser(actor.ID, id, input)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, user)
	}
}
func handleCreateChatMessage(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, user, ok := authenticatedUser(r, store)
		if !ok {
			writeError(w, http.StatusUnauthorized, "please log in first")
			return
		}
		var input ChatInput
		if decodeJSON(w, r, &input) != nil {
			return
		}
		item, err := store.addChatMessage(user.ID, input)
		if err != nil {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, item)
	}
}
func handleListChatMessages(store *Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, user, ok := authenticatedUser(r, store)
		if !ok {
			writeError(w, http.StatusUnauthorized, "please log in first")
			return
		}
		items, err := store.chatBetween(user.ID, r.URL.Query().Get("withUserId"))
		if err != nil {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}

		if normalizedRole(user.Role) == roleUser {
			items = chatMessagesForUserWindow(items)
			writeJSON(w, http.StatusOK, map[string]any{"messages": items, "availableDates": chatHistoryDates(items)})
			return
		}

		selectedDate := strings.TrimSpace(r.URL.Query().Get("date"))
		if selectedDate != "" {
			if _, err := time.Parse("2006-01-02", selectedDate); err != nil {
				writeError(w, http.StatusBadRequest, "invalid chat date")
				return
			}
			filtered := chatMessagesForDate(items, selectedDate)
			writeJSON(w, http.StatusOK, map[string]any{"messages": filtered, "availableDates": chatHistoryDates(items)})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"messages": items, "availableDates": chatHistoryDates(items)})
	}
}

func ensureRoleDemoAccounts(store *Store) error {
	seeds := []struct{ name, email, password, role string }{{"Careflow Admin", "admin@careflow.local", "AdminCareflow2026!", roleAdmin}, {"Dr. Anya Putri", "psychologist@careflow.local", "Psychologist2026!", rolePsychologist}, {"Careflow Demo", "demo@careflow.local", "CareflowDemo2026!", roleUser}}
	for _, seed := range seeds {
		user, ok := store.findUserByEmail(seed.email)
		if !ok {
			var err error
			user, _, err = store.createUser(Credentials{Name: seed.name, Email: seed.email, Password: seed.password})
			if err != nil {
				return err
			}
		}
		if err := store.setUserAccess(user.ID, seed.role, false, "", false); err != nil {
			return err
		}
	}
	return nil
}
