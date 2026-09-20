package main

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

type socketClient struct {
	conn    *websocket.Conn
	writeMu sync.Mutex
}

type chatHub struct {
	mu      sync.RWMutex
	clients map[string]map[*socketClient]struct{}
}

func newChatHub() *chatHub { return &chatHub{clients: make(map[string]map[*socketClient]struct{})} }

func (h *chatHub) add(userID string, client *socketClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[userID] == nil {
		h.clients[userID] = make(map[*socketClient]struct{})
	}
	h.clients[userID][client] = struct{}{}
}
func (h *chatHub) remove(userID string, client *socketClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients[userID], client)
	if len(h.clients[userID]) == 0 {
		delete(h.clients, userID)
	}
}
func (h *chatHub) publish(message ChatMessage) {
	payload, err := json.Marshal(map[string]any{"type": "message", "message": message})
	if err != nil {
		return
	}
	for _, userID := range []string{message.SenderID, message.RecipientID} {
		h.mu.RLock()
		clients := make([]*socketClient, 0, len(h.clients[userID]))
		for client := range h.clients[userID] {
			clients = append(clients, client)
		}
		h.mu.RUnlock()
		for _, client := range clients {
			client.writeMu.Lock()
			err := client.conn.WriteMessage(websocket.TextMessage, payload)
			client.writeMu.Unlock()
			if err != nil {
				h.remove(userID, client)
				_ = client.conn.Close()
			}
		}
	}
}

func handleChatWebSocket(store *Store, hub *chatHub, allowedOrigin string) http.HandlerFunc {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		return origin == "" || origin == allowedOrigin
	}}
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		if token == "" {
			writeError(w, http.StatusUnauthorized, "invalid session")
			return
		}
		user, ok := store.userForToken(token)
		if !ok {
			writeError(w, http.StatusUnauthorized, "invalid session")
			return
		}
		store.hydrateAccess(&user)
		if user.IsBanned {
			writeError(w, http.StatusForbidden, "account is banned")
			return
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		client := &socketClient{conn: conn}
		hub.add(user.ID, client)
		defer func() { hub.remove(user.ID, client); _ = conn.Close() }()
		for {
			var input ChatInput
			if err := conn.ReadJSON(&input); err != nil {
				return
			}
			message, err := store.addChatMessage(user.ID, input)
			if err != nil {
				client.writeMu.Lock()
				_ = conn.WriteJSON(map[string]any{"type": "error", "error": err.Error()})
				client.writeMu.Unlock()
				continue
			}
			hub.publish(message)
		}
	}
}
