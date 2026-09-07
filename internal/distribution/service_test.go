package distribution

import (
	"archive/zip"
	"context"
	"database/sql"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	appdb "bungleware/vault/internal/db"
)

func TestPreparationPackageAndHistory(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	database, err := appdb.New(appdb.Config{DataDir: root, DBFile: "test.db", MigrationsPath: filepath.Join("..", "..", "migrations")})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })

	userID := insertID(t, database.DB, "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", "artist", "artist@example.com", "hash")
	otherUserID := insertID(t, database.DB, "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", "other", "other@example.com", "hash")
	projectID := insertID(t, database.DB, "INSERT INTO projects (user_id, name, public_id, author_override) VALUES (?, ?, ?, ?)", userID, "Live project title", "project-1", "Display Artist")
	trackID := insertID(t, database.DB, "INSERT INTO tracks (user_id, project_id, title, artist, public_id) VALUES (?, ?, ?, ?, ?)", userID, projectID, "Live track title", "Display Artist", "track-1")
	versionID := insertID(t, database.DB, "INSERT INTO track_versions (track_id, version_name, duration_seconds) VALUES (?, ?, ?)", trackID, "Master", 180)
	masterPath := filepath.Join(root, "master.wav")
	masterBytes := []byte("unchanged original master")
	if err = os.WriteFile(masterPath, masterBytes, 0o600); err != nil {
		t.Fatal(err)
	}
	insertID(t, database.DB, "INSERT INTO track_files (version_id, quality, file_path, file_size, format, transcoding_status, original_filename) VALUES (?, 'source', ?, ?, 'wav', 'completed', 'master.wav')", versionID, masterPath, len(masterBytes))
	motionPath := filepath.Join(root, "motion.mp4")
	if err = os.WriteFile(motionPath, []byte("motion artwork"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err = database.ExecContext(ctx, `INSERT INTO project_motion_assets
		(project_id, kind, source_path, source_mime, preview_path, preview_mime, width, height, duration_seconds, codec, frame_rate, bitrate)
		VALUES (?, 'apple_square', ?, 'video/mp4', ?, 'video/mp4', 1000, 1000, 8, 'h264', 30, 1000)`, projectID, motionPath, motionPath); err != nil {
		t.Fatal(err)
	}
	if _, err = database.ExecContext(ctx, "UPDATE tracks SET active_version_id = ? WHERE id = ?", versionID, trackID); err != nil {
		t.Fatal(err)
	}

	service := NewService(database.Queries, root)
	profile, err := service.SaveProfile(ctx, userID, ArtistProfile{DisplayName: "Profile Artist", LegalName: "Legal Name", DefaultCredits: []Credit{{Name: "Legal Name", Role: "Composer"}, {Name: "", Role: "Producer"}, {Name: "Legal Name", Role: "Composer"}}})
	if err != nil || len(profile.DefaultCredits) != 1 {
		t.Fatalf("credits were not cleaned: %#v, %v", profile, err)
	}
	releaseType, releaseDate, language := "Album", "2026-10-01", "en"
	explicit := false
	preparation := Preparation{
		Release: ReleaseOverride{ReleaseType: &releaseType, ReleaseDate: &releaseDate, Language: &language},
		Tracks:  map[int64]TrackOverride{trackID: {Explicit: &explicit, Credits: &[]Credit{{Name: "Guest Writer", Role: "Lyricist"}}}},
	}
	if _, err = service.SavePreparation(ctx, userID, projectID, preparation); err != nil {
		t.Fatal(err)
	}
	release, validation, err := service.Validate(ctx, userID, projectID)
	if err != nil || !validation.CanExport {
		t.Fatalf("expected exportable release: %#v, %v", validation, err)
	}
	if release.Title != "Live project title" || release.Artist != "Display Artist" || len(release.Credits) != 1 || len(release.Tracks[0].Credits) != 1 || release.Tracks[0].Credits[0].Name != "Guest Writer" {
		t.Fatalf("live metadata or credit inheritance failed: %#v", release)
	}

	pkg, _, err := service.BuildPackage(ctx, userID, projectID)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = pkg.Cleanup() })
	archive, err := zip.OpenReader(pkg.Path)
	if err != nil {
		t.Fatal(err)
	}
	defer archive.Close()
	wanted := map[string]bool{"Audio/01 - Live track title.wav": false, "Artwork/apple-motion-1x1.mp4": false, "Metadata/release.json": false, "Metadata/tracks.csv": false, "Credits/credits.csv": false, "checksums.sha256": false, "README.txt": false}
	for _, file := range archive.File {
		if _, ok := wanted[file.Name]; ok {
			wanted[file.Name] = true
		}
		if strings.Contains(strings.ToLower(file.Name), "notes") {
			t.Fatalf("private notes leaked into package: %s", file.Name)
		}
		if strings.HasPrefix(file.Name, "Audio/") {
			reader, openErr := file.Open()
			if openErr != nil {
				t.Fatal(openErr)
			}
			contents, readErr := io.ReadAll(reader)
			_ = reader.Close()
			if readErr != nil || string(contents) != string(masterBytes) {
				t.Fatalf("package did not preserve original master: %q, %v", contents, readErr)
			}
		}
	}
	for name, found := range wanted {
		if !found {
			t.Errorf("missing package entry %s", name)
		}
	}

	if _, err = database.ExecContext(ctx, "UPDATE projects SET name = 'Changed after export' WHERE id = ?", projectID); err != nil {
		t.Fatal(err)
	}
	current, err := service.Resolve(ctx, userID, projectID)
	if err != nil || current.Title != "Changed after export" {
		t.Fatalf("preparation stopped following live project data: %#v, %v", current, err)
	}
	history, err := service.History(ctx, userID, projectID)
	if err != nil || len(history) != 1 || history[0].Snapshot.Title != "Live project title" || history[0].Status != "succeeded" {
		t.Fatalf("operation snapshot was not immutable: %#v, %v", history, err)
	}
	if _, err = service.GetPreparation(ctx, otherUserID, projectID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("other user accessed preparation: %v", err)
	}
}

func insertID(t *testing.T, db *sql.DB, query string, args ...any) int64 {
	t.Helper()
	result, err := db.Exec(query, args...)
	if err != nil {
		t.Fatal(err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func TestIdentifierAndDateValidation(t *testing.T) {
	for value, valid := range map[string]bool{
		"USRC17607839":    true,
		"US-RC1-76-07839": true,
		"1SRC17607839":    false,
		"USRC1760783":     false,
	} {
		if got := validISRC(normalizeISRC(value)); got != valid {
			t.Errorf("validISRC(%q) = %v, want %v", value, got, valid)
		}
	}
	if !validUPC("012345678905") || validUPC("01234ABC8905") {
		t.Fatal("UPC validation accepted invalid characters or rejected a valid code")
	}
	if !validDate("2026-09-05") || validDate("2026-02-30") {
		t.Fatal("date validation did not enforce a real YYYY-MM-DD date")
	}
	if strings.ContainsAny(safeName("release\r\nname"), "\r\n") {
		t.Fatal("safeName retained control characters")
	}
}

func TestAssetPathRejectsFilesOutsideStorage(t *testing.T) {
	root := t.TempDir()
	outside := filepath.Join(t.TempDir(), "outside.wav")
	if err := os.WriteFile(outside, []byte("private"), 0o600); err != nil {
		t.Fatal(err)
	}
	service := &Service{root: root}
	if _, err := service.assetPath(outside); !errors.Is(err, ErrAssets) {
		t.Fatalf("expected outside asset to be rejected, got %v", err)
	}
}
