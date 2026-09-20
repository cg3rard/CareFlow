package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
)

func TestPsychologistAssignmentAndPrivateChat(t *testing.T) {
	store, err := newStore(filepath.Join(t.TempDir(), "careflow.json"))
	if err != nil {
		t.Fatalf("newStore() error = %v", err)
	}
	if err := ensureRoleDemoAccounts(store); err != nil {
		t.Fatalf("ensureRoleDemoAccounts() error = %v", err)
	}

	user, userToken, err := store.createUser(Credentials{Name: "User Test", Email: "user@example.com", Password: "safe-password"})
	if err != nil {
		t.Fatalf("createUser() error = %v", err)
	}
	psychologist, ok := store.findUserByEmail("psychologist@careflow.local")
	if !ok || normalizedRole(psychologist.Role) != rolePsychologist {
		t.Fatal("psychologist demo account was not seeded")
	}

	selectRequest := httptest.NewRequest(http.MethodPost, "/api/psychologists/select", bytes.NewBufferString(`{"psychologistId":"`+psychologist.ID+`","shareDataWithPsychologist":true}`))
	selectRequest.Header.Set("Authorization", "Bearer "+userToken)
	selectResponse := httptest.NewRecorder()
	handleSelectPsychologist(store).ServeHTTP(selectResponse, selectRequest)
	if selectResponse.Code != http.StatusOK {
		t.Fatalf("select status = %d, body = %s", selectResponse.Code, selectResponse.Body.String())
	}

	chatRequest := httptest.NewRequest(http.MethodPost, "/api/chat/messages", bytes.NewBufferString(`{"recipientId":"`+psychologist.ID+`","content":"I would like a consultation."}`))
	chatRequest.Header.Set("Authorization", "Bearer "+userToken)
	chatResponse := httptest.NewRecorder()
	handleCreateChatMessage(store).ServeHTTP(chatResponse, chatRequest)
	if chatResponse.Code != http.StatusCreated {
		t.Fatalf("chat status = %d, body = %s", chatResponse.Code, chatResponse.Body.String())
	}

	_, psychologistToken, err := store.login("psychologist@careflow.local", "Psychologist2026!")
	if err != nil {
		t.Fatalf("psychologist login error = %v", err)
	}
	clientRequest := httptest.NewRequest(http.MethodGet, "/api/psychologist/clients", nil)
	clientRequest.Header.Set("Authorization", "Bearer "+psychologistToken)
	clientResponse := httptest.NewRecorder()
	handlePsychologistClients(store).ServeHTTP(clientResponse, clientRequest)
	if clientResponse.Code != http.StatusOK {
		t.Fatalf("clients status = %d, body = %s", clientResponse.Code, clientResponse.Body.String())
	}
	var clients struct {
		Clients []ProfileResponse `json:"clients"`
	}
	if err := json.Unmarshal(clientResponse.Body.Bytes(), &clients); err != nil {
		t.Fatalf("decode clients: %v", err)
	}
	if len(clients.Clients) != 1 || clients.Clients[0].ID != user.ID {
		t.Fatalf("unexpected assigned clients: %#v", clients.Clients)
	}

	admin, _, err := store.login("admin@careflow.local", "AdminCareflow2026!")
	if err != nil {
		t.Fatalf("admin login error = %v", err)
	}
	store.hydrateAccess(&admin)
	if normalizedRole(admin.Role) != roleAdmin {
		t.Fatalf("admin role = %q, want admin", admin.Role)
	}
}


func TestDeclutterEntryUsesPersistedSharingConsent(t *testing.T) {
	store, err := newStore(filepath.Join(t.TempDir(), "careflow.json"))
	if err != nil {
		t.Fatalf("newStore() error = %v", err)
	}
	if err := ensureRoleDemoAccounts(store); err != nil {
		t.Fatalf("ensureRoleDemoAccounts() error = %v", err)
	}

	user, token, err := store.createUser(Credentials{Name: "Shared Note User", Email: "shared-note@example.com", Password: "safe-password"})
	if err != nil {
		t.Fatalf("createUser() error = %v", err)
	}
	psychologist, ok := store.findUserByEmail("psychologist@careflow.local")
	if !ok {
		t.Fatal("psychologist demo account was not seeded")
	}
	if err := store.selectPsychologist(user.ID, psychologist.ID, true); err != nil {
		t.Fatalf("selectPsychologist() error = %v", err)
	}

	request := httptest.NewRequest(http.MethodPost, "/api/declutter", bytes.NewBufferString(`{"content":"My thoughts keep spinning at night.","tag":"Late Night Overthinking 🌙","panicLevel":4,"shareWithPsychologist":false}`))
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	handleCreateDeclutterEntry(store).ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("declutter status = %d, body = %s", response.Code, response.Body.String())
	}
	var entry DeclutterEntry
	if err := json.Unmarshal(response.Body.Bytes(), &entry); err != nil {
		t.Fatalf("decode entry: %v", err)
	}
	if !entry.ShareWithPsychologist {
		t.Fatal("expected persisted consent to share the finalized Brain Dump")
	}

	careData, err := store.clientCareData(psychologist.ID, user.ID)
	if err != nil {
		t.Fatalf("clientCareData() error = %v", err)
	}
	if len(careData.DeclutterEntries) != 1 || careData.DeclutterEntries[0].ID != entry.ID {
		t.Fatalf("shared Brain Dump missing from psychologist data: %#v", careData.DeclutterEntries)
	}
}

func TestChatHistoryLimitsUsersButAllowsPsychologistDateAccess(t *testing.T) {
	store, err := newStore(filepath.Join(t.TempDir(), "careflow.json"))
	if err != nil {
		t.Fatalf("newStore() error = %v", err)
	}
	if err := ensureRoleDemoAccounts(store); err != nil {
		t.Fatalf("ensureRoleDemoAccounts() error = %v", err)
	}

	user, userToken, err := store.createUser(Credentials{Name: "History User", Email: "history@example.com", Password: "safe-password"})
	if err != nil {
		t.Fatalf("createUser() error = %v", err)
	}
	psychologist, ok := store.findUserByEmail("psychologist@careflow.local")
	if !ok {
		t.Fatal("psychologist demo account was not seeded")
	}
	if err := store.selectPsychologist(user.ID, psychologist.ID, true); err != nil {
		t.Fatalf("selectPsychologist() error = %v", err)
	}

	oldMessage := ChatMessage{ID: newID(), SenderID: user.ID, RecipientID: psychologist.ID, Content: "Old message", CreatedAt: time.Now().AddDate(0, 0, -3).UTC()}
	recentMessage := ChatMessage{ID: newID(), SenderID: psychologist.ID, RecipientID: user.ID, Content: "Recent message", CreatedAt: time.Now().UTC()}
	store.chatMessages = append(store.chatMessages, oldMessage, recentMessage)

	userRequest := httptest.NewRequest(http.MethodGet, "/api/chat/messages?withUserId="+psychologist.ID, nil)
	userRequest.Header.Set("Authorization", "Bearer "+userToken)
	userResponse := httptest.NewRecorder()
	handleListChatMessages(store).ServeHTTP(userResponse, userRequest)
	if userResponse.Code != http.StatusOK {
		t.Fatalf("user history status = %d, body = %s", userResponse.Code, userResponse.Body.String())
	}
	var userHistory struct { Messages []ChatMessage `json:"messages"` }
	if err := json.Unmarshal(userResponse.Body.Bytes(), &userHistory); err != nil {
		t.Fatalf("decode user history: %v", err)
	}
	if len(userHistory.Messages) != 1 || userHistory.Messages[0].ID != recentMessage.ID {
		t.Fatalf("user should receive only recent history, got %#v", userHistory.Messages)
	}

	_, psychologistToken, err := store.login("psychologist@careflow.local", "Psychologist2026!")
	if err != nil {
		t.Fatalf("psychologist login error = %v", err)
	}
	oldDate := chatHistoryDate(oldMessage.CreatedAt)
	psychologistRequest := httptest.NewRequest(http.MethodGet, "/api/chat/messages?withUserId="+user.ID+"&date="+oldDate, nil)
	psychologistRequest.Header.Set("Authorization", "Bearer "+psychologistToken)
	psychologistResponse := httptest.NewRecorder()
	handleListChatMessages(store).ServeHTTP(psychologistResponse, psychologistRequest)
	if psychologistResponse.Code != http.StatusOK {
		t.Fatalf("psychologist history status = %d, body = %s", psychologistResponse.Code, psychologistResponse.Body.String())
	}
	var psychologistHistory struct { Messages []ChatMessage `json:"messages"` }
	if err := json.Unmarshal(psychologistResponse.Body.Bytes(), &psychologistHistory); err != nil {
		t.Fatalf("decode psychologist history: %v", err)
	}
	if len(psychologistHistory.Messages) != 1 || psychologistHistory.Messages[0].ID != oldMessage.ID {
		t.Fatalf("psychologist should retrieve the selected older date, got %#v", psychologistHistory.Messages)
	}
}
