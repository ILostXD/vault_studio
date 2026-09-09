package handlers

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"bungleware/vault/internal/db"
	sqlc "bungleware/vault/internal/db/sqlc"
	"bungleware/vault/internal/middleware"
)

func TestKeyModePreferencePersistence(t *testing.T) {
	database, err := db.New(db.Config{DataDir: t.TempDir(), DBFile: "vault.db", MigrationsPath: "../../migrations"})
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	ctx := context.Background()
	user, err := database.CreateUser(ctx, sqlc.CreateUserParams{Username: "artist", PasswordHash: "unused"})
	if err != nil {
		t.Fatal(err)
	}
	if err := database.CreateUserPreferences(ctx, sqlc.CreateUserPreferencesParams{UserID: user.ID, DefaultQuality: "source"}); err != nil {
		t.Fatal(err)
	}
	prefs, err := database.GetUserPreferences(ctx, user.ID)
	if err != nil || prefs.KeyModePreference != "detected" {
		t.Fatalf("default: %+v, %v", prefs, err)
	}
	for _, mode := range []string{"minor", "major", "detected"} {
		r := httptest.NewRequest("PUT", "/api/preferences", strings.NewReader(`{"key_mode_preference":"`+mode+`"}`))
		r = r.WithContext(context.WithValue(ctx, middleware.UserIDKey, int(user.ID)))
		w := httptest.NewRecorder()
		if err := NewPreferencesHandler(database).UpdatePreferences(w, r); err != nil {
			t.Fatal(err)
		}
		var updated PreferencesResponse
		if err := json.Unmarshal(w.Body.Bytes(), &updated); err != nil {
			t.Fatal(err)
		}
		if updated.KeyModePreference != mode || updated.DefaultQuality != "source" {
			t.Fatalf("response: %+v", updated)
		}

		// A fresh handler reading from storage must return the same setting.
		w = httptest.NewRecorder()
		if err := NewPreferencesHandler(database).GetPreferences(w, r); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(w.Body.Bytes(), &updated); err != nil {
			t.Fatal(err)
		}
		if updated.KeyModePreference != mode {
			t.Fatalf("preference did not persist: %+v", updated)
		}
	}
	for _, body := range []string{`{"key_mode_preference":"dorian"}`, `{"key_mode_preference":""}`, `{"key_mode_preference":true}`} {
		r := httptest.NewRequest("PUT", "/api/preferences", strings.NewReader(body))
		r = r.WithContext(context.WithValue(ctx, middleware.UserIDKey, int(user.ID)))
		if err := NewPreferencesHandler(database).UpdatePreferences(httptest.NewRecorder(), r); err == nil {
			t.Fatalf("accepted invalid setting: %s", body)
		}
	}
	r := httptest.NewRequest("PUT", "/api/preferences", strings.NewReader(`{"theme":"light"}`))
	r = r.WithContext(context.WithValue(ctx, middleware.UserIDKey, int(user.ID)))
	if err := NewPreferencesHandler(database).UpdatePreferences(httptest.NewRecorder(), r); err != nil {
		t.Fatal(err)
	}
	prefs, err = database.GetUserPreferences(ctx, user.ID)
	if err != nil || prefs.KeyModePreference != "detected" || prefs.Theme != "light" {
		t.Fatalf("partial update: %+v, %v", prefs, err)
	}
}
