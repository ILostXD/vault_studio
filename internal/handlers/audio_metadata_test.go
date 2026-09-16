package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"bungleware/vault/internal/audiometadata"
	appdb "bungleware/vault/internal/db"
	"bungleware/vault/internal/httputil"
	"bungleware/vault/internal/middleware"
)

func TestAudioMetadataAPI(t *testing.T) {
	root := t.TempDir()
	db, err := appdb.New(appdb.Config{DataDir: root, DBFile: "test.db", MigrationsPath: "../../migrations"})
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, query := range []string{
		"INSERT INTO users(id,username,email,password_hash) VALUES (1,'owner','a@test','hash'),(2,'other','b@test','hash')",
		"INSERT INTO projects(id,user_id,name,public_id) VALUES(1,1,'Album','project')",
	} {
		if _, err = db.Exec(query); err != nil {
			t.Fatal(err)
		}
	}
	h := NewAudioMetadataHandler(audiometadata.NewService(db, root))
	mux := http.NewServeMux()
	mux.Handle("GET /api/projects/{id}/audio-metadata", httputil.Wrap(h.Get))
	mux.Handle("PUT /api/projects/{id}/audio-metadata", httputil.Wrap(h.Save))
	mux.Handle("GET /api/projects/{id}/tracks/{trackId}/tagged-download", httputil.Wrap(h.Download))
	call := func(method, url, body string, user int) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, url, strings.NewReader(body))
		if user > 0 {
			r = r.WithContext(context.WithValue(r.Context(), middleware.UserIDKey, user))
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}
	endpoint := "/api/projects/1/audio-metadata"
	if w := call("GET", endpoint, "", 0); w.Code != 401 {
		t.Fatalf("auth: %d", w.Code)
	}
	if w := call("GET", endpoint, "", 2); w.Code != 404 {
		t.Fatalf("ownership: %d", w.Code)
	}
	if w := call("PUT", endpoint, `{"album":"Stolen"}`, 2); w.Code != 404 {
		t.Fatalf("save ownership: %d", w.Code)
	}
	if w := call("PUT", endpoint, `{"album":"Updated","artist":"DiRO","year":"2026"}`, 1); w.Code != 200 || !strings.Contains(w.Body.String(), `"album":"Updated"`) {
		t.Fatalf("save: %d %s", w.Code, w.Body)
	}
	if w := call("GET", endpoint, "", 1); w.Code != 200 || !strings.Contains(w.Body.String(), `"artist":"DiRO"`) {
		t.Fatalf("read: %d %s", w.Code, w.Body)
	}
	if w := call("PUT", endpoint, `{"album":"Updated","year":"today"}`, 1); w.Code != 400 {
		t.Fatalf("validation: %d", w.Code)
	}
	if w := call("PUT", endpoint, strings.Repeat(" ", 17000)+`{}`, 1); w.Code != 400 {
		t.Fatalf("body limit: %d", w.Code)
	}
	if w := call("GET", "/api/projects/1/tracks/1/tagged-download", "", 1); w.Code != 400 {
		t.Fatalf("missing version: %d", w.Code)
	}
	if w := call("GET", "/api/projects/1/tracks/1/tagged-download?version_id=1", "", 2); w.Code != 404 {
		t.Fatalf("download ownership: %d", w.Code)
	}
}
