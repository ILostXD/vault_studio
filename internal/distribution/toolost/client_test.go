package toolost

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAuthorizationURLUsesPKCE(t *testing.T) {
	c := Client{ClientID: "client", RedirectURI: "https://vault.example/api/integrations/toolost/callback"}
	u, err := c.AuthorizationURL("state", "challenge", []string{"read:releases", "write:releases"})
	if err != nil {
		t.Fatal(err)
	}
	for _, part := range []string{"code_challenge=challenge", "code_challenge_method=S256", "state=state", "response_type=code"} {
		if !strings.Contains(u, part) {
			t.Fatalf("missing %s in %s", part, u)
		}
	}
}

func TestDraftEndpointsNeverSubmit(t *testing.T) {
	paths := []string{}
	metadata := map[string]any{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.Method+" "+r.URL.Path)
		if r.URL.Path == "/v1/releases" {
			_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]any{"id": 42, "status": "draft"}})
			return
		}
		if r.Method == http.MethodPatch && strings.HasSuffix(r.URL.Path, "/metadata") {
			if err := json.NewDecoder(r.Body).Decode(&metadata); err != nil {
				t.Fatal(err)
			}
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()
	c := Client{HTTP: server.Client(), APIBase: server.URL + "/v1"}
	draft, err := c.CreateDraft(context.Background(), "token", CreateDraftRequest{Type: "Single", Title: "Song", Participants: []Participant{{Name: "Artist", Roles: []string{"primary"}}}})
	if err != nil || draft.ID != "42" {
		t.Fatal(draft, err)
	}
	if err = c.ReplaceTracks(context.Background(), "token", draft.ID, []Track{}); err != nil {
		t.Fatal(err)
	}
	if err = c.PatchMetadata(context.Background(), "token", draft.ID, MetadataRequest{Title: "Song", CLine: "2026 Artist", PLine: "2026 Artist", CoverURL: "https://vault.example/cover"}); err != nil {
		t.Fatal(err)
	}
	if _, err = c.RequestUploadURL(context.Background(), "token", draft.ID, UploadURLRequest{Kind: "stereo", Filename: "song.flac", ContentType: "audio/flac"}); err != nil {
		t.Fatal(err)
	}
	if _, err = c.GetRelease(context.Background(), "token", draft.ID); err != nil {
		t.Fatal(err)
	}
	for _, p := range paths {
		if strings.Contains(p, "submit") {
			t.Fatalf("submission endpoint called: %s", p)
		}
	}
	want := []string{
		"POST /v1/releases",
		"PUT /v1/releases/42/tracks",
		"PATCH /v1/releases/42/metadata",
		"POST /v1/releases/42/tracks/upload-url",
		"GET /v1/releases/42",
	}
	if strings.Join(paths, ",") != strings.Join(want, ",") {
		t.Fatalf("unexpected Too Lost paths: got %v, want %v", paths, want)
	}
	for key, wantValue := range map[string]string{"cLine": "2026 Artist", "pLine": "2026 Artist", "coverUrl": "https://vault.example/cover"} {
		if metadata[key] != wantValue {
			t.Fatalf("metadata %s = %#v, want %q", key, metadata[key], wantValue)
		}
	}
}

func TestLookupEndpoints(t *testing.T) {
	paths := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/v1/lookup/genres":
			_ = json.NewEncoder(w).Encode(map[string]any{"data": []string{"Alternative", "Hip-Hop/Rap"}})
		case "/v1/lookup/languages":
			_ = json.NewEncoder(w).Encode(map[string]any{"data": []map[string]string{{"code": "en", "name": "English"}, {"code": "zxx", "name": "Instrumental"}}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	c := Client{HTTP: server.Client(), APIBase: server.URL + "/v1"}
	genres, err := c.ListGenres(context.Background(), "token")
	if err != nil || len(genres) != 2 || genres[1] != "Hip-Hop/Rap" {
		t.Fatalf("unexpected genres %#v, error %v", genres, err)
	}
	languages, err := c.ListLanguages(context.Background(), "token")
	if err != nil || len(languages) != 2 || languages[0].Code != "en" {
		t.Fatalf("unexpected languages %#v, error %v", languages, err)
	}
	if strings.Join(paths, ",") != "/v1/lookup/genres,/v1/lookup/languages" {
		t.Fatalf("unexpected lookup paths %v", paths)
	}
}

func TestUploadRejectsUnsafeTarget(t *testing.T) {
	c := Client{}
	if err := c.Upload(context.Background(), UploadTarget{UploadURL: "http://example.com/upload"}, strings.NewReader("audio"), 5); err == nil {
		t.Fatal("expected HTTP upload URL to be rejected")
	}
	if err := c.Upload(context.Background(), UploadTarget{UploadURL: "https://example.com/upload", Method: http.MethodPost}, strings.NewReader("audio"), 5); err == nil {
		t.Fatal("expected unsupported upload method to be rejected")
	}
}

func TestAPIErrorPreservesRateLimit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Retry-After", "12")
		http.Error(w, "quota", http.StatusTooManyRequests)
	}))
	defer server.Close()
	c := Client{HTTP: server.Client(), APIBase: server.URL}
	_, err := c.GetRelease(context.Background(), "token", "1")
	apiErr, ok := err.(*APIError)
	if !ok || apiErr.Status != 429 || apiErr.RetryAfter != "12" {
		t.Fatalf("unexpected error %#v", err)
	}
}
