package handlers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"bungleware/vault/internal/db"
	sqlc "bungleware/vault/internal/db/sqlc"
	"bungleware/vault/internal/middleware"
)

func TestTooLostConfigurationIsEncryptedAndReloaded(t *testing.T) {
	database, err := db.New(db.Config{
		DataDir:        t.TempDir(),
		DBFile:         "vault.db",
		MigrationsPath: "../../migrations",
	})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	defer database.Close()

	user, err := database.Queries.CreateUser(context.Background(), sqlc.CreateUserParams{
		Username: "admin", PasswordHash: "unused", IsAdmin: true, IsOwner: true,
	})
	if err != nil {
		t.Fatalf("create admin: %v", err)
	}
	key := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{7}, 32))
	handler := NewTooLostHandler(database.Queries, nil, TooLostConfig{
		TokenEncryptionKey: key,
		SignedURLSecret:    "signed-url-secret",
	})

	body := `{"client_id":"client-123","client_secret":"very-secret","public_base_url":"https://vault.example.com/","environment":"production"}`
	request := httptest.NewRequest("PUT", "/api/admin/integrations/toolost", strings.NewReader(body))
	request = request.WithContext(context.WithValue(request.Context(), middleware.UserIDKey, int(user.ID)))
	response := httptest.NewRecorder()
	if err := handler.SaveConfiguration(response, request); err != nil {
		t.Fatalf("save configuration: %v", err)
	}

	var result map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if result["configured"] != true || result["callback_url"] != "https://vault.example.com/api/integrations/toolost/callback" {
		t.Fatalf("unexpected response: %v", result)
	}
	if strings.Contains(response.Body.String(), "very-secret") {
		t.Fatal("configuration response exposed the client secret")
	}

	row, err := database.Queries.GetProviderSetting(context.Background(), "toolost")
	if err != nil {
		t.Fatalf("load stored configuration: %v", err)
	}
	if bytes.Contains(row.EncryptedConfig, []byte("very-secret")) {
		t.Fatal("client secret was stored as plaintext")
	}

	reloaded := NewTooLostHandler(database.Queries, nil, TooLostConfig{
		TokenEncryptionKey: key,
		SignedURLSecret:    "signed-url-secret",
	})
	config, client := reloaded.runtime()
	if config.ClientID != "client-123" || config.ClientSecret != "very-secret" || config.Environment != "production" {
		t.Fatalf("persisted configuration was not restored: %+v", config)
	}
	if client.RedirectURI != "https://vault.example.com/api/integrations/toolost/callback" {
		t.Fatalf("redirect URI = %q", client.RedirectURI)
	}
}

func TestValidatePublicBaseURL(t *testing.T) {
	for _, value := range []string{"http://vault.example.com", "https://", "https://vault.example.com?token=nope"} {
		if err := validatePublicBaseURL(value); err == nil {
			t.Errorf("validatePublicBaseURL(%q) unexpectedly succeeded", value)
		}
	}
	if err := validatePublicBaseURL("https://vault.example.com"); err != nil {
		t.Fatalf("valid public URL rejected: %v", err)
	}
}
