package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
)

func TestAccountSessionFlow(t *testing.T) {
	store, err := newStore(filepath.Join(t.TempDir(), "careflow.json"))
	if err != nil {
		t.Fatalf("newStore() error = %v", err)
	}

	registerBody := bytes.NewBufferString(`{"name":"Ayu Test","email":"ayu@example.com","password":"password-aman"}`)
	registerRequest := httptest.NewRequest(http.MethodPost, "/api/auth/register", registerBody)
	registerResponse := httptest.NewRecorder()
	handleRegister(store).ServeHTTP(registerResponse, registerRequest)
	if registerResponse.Code != http.StatusCreated {
		t.Fatalf("register status = %d, body = %s", registerResponse.Code, registerResponse.Body.String())
	}
	var registered struct {
		Token string          `json:"token"`
		User  ProfileResponse `json:"user"`
	}
	if err := json.Unmarshal(registerResponse.Body.Bytes(), &registered); err != nil {
		t.Fatalf("decode register response: %v", err)
	}
	if registered.Token == "" || registered.User.Name != "Ayu Test" {
		t.Fatalf("unexpected register response: %#v", registered)
	}

	sessionRequest := httptest.NewRequest(http.MethodPost, "/api/sessions", bytes.NewBufferString(`{"mood":"Happy","mascot":"Gentle","completedTasksCount":3,"totalXp":45}`))
	sessionRequest.Header.Set("Authorization", "Bearer "+registered.Token)
	sessionResponse := httptest.NewRecorder()
	handleCreateSession(store).ServeHTTP(sessionResponse, sessionRequest)
	if sessionResponse.Code != http.StatusCreated {
		t.Fatalf("create session status = %d, body = %s", sessionResponse.Code, sessionResponse.Body.String())
	}

	meRequest := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	meRequest.Header.Set("Authorization", "Bearer "+registered.Token)
	meResponse := httptest.NewRecorder()
	handleMe(store).ServeHTTP(meResponse, meRequest)
	if meResponse.Code != http.StatusOK {
		t.Fatalf("me status = %d, body = %s", meResponse.Code, meResponse.Body.String())
	}
	var profile ProfileResponse
	if err := json.Unmarshal(meResponse.Body.Bytes(), &profile); err != nil {
		t.Fatalf("decode profile response: %v", err)
	}
	if profile.StreakDays != 1 {
		t.Fatalf("streakDays = %d, want 1", profile.StreakDays)
	}

	loginRequest := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"email":"ayu@example.com","password":"password-aman"}`))
	loginResponse := httptest.NewRecorder()
	handleLogin(store).ServeHTTP(loginResponse, loginRequest)
	if loginResponse.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", loginResponse.Code, loginResponse.Body.String())
	}
}

func TestEnsureDemoAccount(t *testing.T) {
	store, err := newStore(filepath.Join(t.TempDir(), "careflow.json"))
	if err != nil {
		t.Fatalf("newStore() error = %v", err)
	}
	cfg := Config{DemoName: "Careflow Demo", DemoEmail: "demo@careflow.local", DemoPassword: "CareflowDemo2026!"}
	if err := ensureDemoAccount(store, cfg); err != nil {
		t.Fatalf("ensureDemoAccount() error = %v", err)
	}
	if err := ensureDemoAccount(store, cfg); err != nil {
		t.Fatalf("ensureDemoAccount() repeat error = %v", err)
	}
	user, _, err := store.login(cfg.DemoEmail, cfg.DemoPassword)
	if err != nil || user.Name != cfg.DemoName {
		t.Fatalf("demo login = (%#v, %v), want demo user", user, err)
	}
}
