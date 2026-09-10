package projects

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"bungleware/vault/internal/db"
	"bungleware/vault/internal/httputil"
	"bungleware/vault/internal/middleware"
	"bungleware/vault/internal/service"
	"bungleware/vault/internal/storage"
)

func TestProjectExportProgressAndDownload(t *testing.T) {
	root := t.TempDir()
	want := strings.Repeat("original master", 10000)
	source := filepath.Join(root, "master.wav")
	if err := os.WriteFile(source, []byte(want), 0600); err != nil {
		t.Fatal(err)
	}
	var loaded, calls int64
	archive, err := buildProjectExport(context.Background(), []projectExportFile{{source, "Track.wav"}}, func(current, total int64, name string) {
		if current < loaded || current > total || total != int64(len(want)) || name != "Track.wav" {
			t.Fatalf("invalid progress: %d / %d, %q", current, total, name)
		}
		loaded = current
		calls++
	})
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(archive.Name())
	defer archive.Close()
	if loaded != int64(len(want)) || calls < 3 {
		t.Fatalf("progress stopped at %d (%d calls)", loaded, calls)
	}

	info, err := archive.Stat()
	if err != nil {
		t.Fatal(err)
	}
	reader, err := zip.NewReader(archive, info.Size())
	if err != nil {
		t.Fatal(err)
	}
	if len(reader.File) != 1 || reader.File[0].Name != "Track.wav" {
		t.Fatal("wrong ZIP contents")
	}
	file, err := reader.File[0].Open()
	if err != nil {
		t.Fatal(err)
	}
	got, err := io.ReadAll(file)
	file.Close()
	if err != nil || string(got) != want {
		t.Fatal("ZIP did not preserve the original master")
	}

	w := httptest.NewRecorder()
	http.ServeContent(w, httptest.NewRequest("GET", "/export", nil), "project.zip", time.Time{}, archive)
	if w.Code != 200 || w.Header().Get("Content-Length") != strconv.FormatInt(info.Size(), 10) || int64(w.Body.Len()) != info.Size() {
		t.Fatalf("download length mismatch: %d, %s, %d", w.Code, w.Header().Get("Content-Length"), w.Body.Len())
	}
}

func TestProjectExportFailuresAndCleanup(t *testing.T) {
	root := t.TempDir()
	t.Setenv("TMPDIR", root)
	t.Setenv("TMP", root)
	t.Setenv("TEMP", root)
	source := filepath.Join(root, "master.wav")
	if err := os.WriteFile(source, []byte("master"), 0600); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	archive, err := buildProjectExport(ctx, []projectExportFile{{source, "Track.wav"}}, func(_, _ int64, _ string) { cancel() })
	if archive != nil || !errors.Is(err, context.Canceled) {
		t.Fatalf("cancel: %v", err)
	}
	matches, _ := filepath.Glob(filepath.Join(root, "vault-project-export-*"))
	if len(matches) != 0 {
		t.Fatal("cancelled export left a temporary ZIP")
	}
	if _, err := buildProjectExport(context.Background(), []projectExportFile{{source + "-missing", "Missing.wav"}}, func(_, _ int64, _ string) {}); err == nil {
		t.Fatal("missing master must fail instead of silently exporting an incomplete ZIP")
	}
}

func TestExportProjectHTTPIncludesSharedMastersAndRejectsIncompleteZIP(t *testing.T) {
	root := t.TempDir()
	database, err := db.New(db.Config{DataDir: root, DBFile: "test.db", MigrationsPath: "../../../migrations"})
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := database.Exec(query, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec("INSERT INTO users (id, username, email, password_hash) VALUES (1, 'owner', 'owner@example.com', 'hash'), (2, 'listener', 'listener@example.com', 'hash')")
	exec("INSERT INTO projects (id, user_id, name, public_id) VALUES (1, 1, 'Album', 'project-1')")
	exec("INSERT INTO tracks (id, user_id, project_id, title, public_id) VALUES (1, 1, 1, 'Song', 'track-1')")
	exec("INSERT INTO track_versions (id, track_id, version_name) VALUES (1, 1, 'Master')")
	exec("UPDATE tracks SET active_version_id = 1 WHERE id = 1")
	source := filepath.Join(root, "master.wav")
	if err := os.WriteFile(source, []byte("original master"), 0600); err != nil {
		t.Fatal(err)
	}
	exec("INSERT INTO track_files (version_id, quality, file_path, file_size, format) VALUES (1, 'source', ?, 15, 'wav')", source)
	exec("INSERT INTO user_project_shares (project_id, shared_by, shared_to, can_download) VALUES (1, 1, 2, 1)")
	svc := service.NewService(database, storage.NewFilesystemStorage(root))
	h := NewProjectsHandler(svc.Projects, database, root, nil)
	request := func() *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest("GET", "/api/projects/project-1/export", nil)
		r.SetPathValue("id", "project-1")
		r = r.WithContext(context.WithValue(r.Context(), middleware.UserIDKey, 2))
		w := httptest.NewRecorder()
		httputil.Wrap(h.ExportProject).ServeHTTP(w, r)
		return w
	}
	w := request()
	if w.Code != 200 || w.Header().Get("Content-Length") != strconv.Itoa(w.Body.Len()) {
		t.Fatalf("export: %d %s", w.Code, w.Body.String())
	}
	zr, err := zip.NewReader(bytes.NewReader(w.Body.Bytes()), int64(w.Body.Len()))
	if err != nil || len(zr.File) != 1 || zr.File[0].Name != "Song.wav" {
		t.Fatalf("shared master missing: %v", err)
	}
	exec("UPDATE user_project_shares SET can_download = 0")
	if w := request(); w.Code != http.StatusForbidden {
		t.Fatalf("download permission bypassed: %d", w.Code)
	}
	exec("UPDATE user_project_shares SET can_download = 1")
	if err := os.Remove(source); err != nil {
		t.Fatal(err)
	}
	if w := request(); w.Code != 500 || w.Header().Get("Content-Type") == "application/zip" {
		t.Fatalf("missing master returned a successful ZIP: %d", w.Code)
	}
}
