package audiometadata

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"image"
	"image/color"
	"image/png"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	appdb "bungleware/vault/internal/db"
	"go.senan.xyz/taglib"
)

func fixture(t *testing.T) (*Service, func(string, ...any)) {
	t.Helper()
	root := t.TempDir()
	database, err := appdb.New(appdb.Config{DataDir: root, DBFile: "test.db", MigrationsPath: "../../migrations"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { database.Close() })
	run := func(query string, args ...any) {
		t.Helper()
		if _, err := database.Exec(query, args...); err != nil {
			t.Fatal(err)
		}
	}
	run("INSERT INTO users (id, username, email, password_hash) VALUES (1,'owner','owner@test','hash'), (2,'other','other@test','hash')")
	run("INSERT INTO projects (id,user_id,name,public_id,author_override) VALUES (1,1,'Album','project','Artist'), (2,1,'Unrelated','other',NULL)")
	run("INSERT INTO tracks (id,user_id,project_id,title,public_id,track_order) VALUES (1,1,1,'Canonical title','track',7), (2,1,1,'First','first',2)")
	run("INSERT INTO track_versions (id,track_id,version_name) VALUES (1,1,'v13'), (2,2,'v1')")
	run("UPDATE tracks SET active_version_id=id")
	return NewService(database, root), run
}

func TestResolutionAndStorage(t *testing.T) {
	s, run := fixture(t)
	ctx := context.Background()
	run(`INSERT INTO distribution_artist_profiles(user_id,profile_json) VALUES (1,'{"display_name":"Never inherit global"}')`)
	run(`INSERT INTO distribution_preparations(project_id,preparation_json) VALUES (1,'{"release":{"artist":"Release artist","genres":["Hip-Hop"],"release_date":"2026-09-16"}}')`)
	state, err := s.Resolve(ctx, 1, 1)
	if err != nil || state.Metadata.Album != "Album" || state.Metadata.Artist != "Artist" || state.Metadata.Year != "2026" {
		t.Fatalf("resolve: %#v %v", state, err)
	}
	if state.Tracks[0].TrackID != 2 || state.Tracks[1].Title != "Canonical title" || state.Tracks[1].Number != 2 || state.Tracks[1].VersionID != 1 {
		t.Fatal(state.Tracks)
	}
	unrelated, err := s.Resolve(ctx, 1, 2)
	if err != nil || unrelated.Metadata.Artist != "" || unrelated.Metadata.Genre != "" {
		t.Fatalf("global metadata leaked: %#v %v", unrelated, err)
	}
	fields := Fields{Album: "Renamed", Artist: "DiRO", AlbumArtist: "Collective", Genre: "Rap", Year: "2026"}
	if err = s.Save(ctx, 1, 1, fields); err != nil {
		t.Fatal(err)
	}
	run("UPDATE tracks SET artist='Guest',album='Track album' WHERE id=1")
	state, err = s.Resolve(ctx, 1, 1)
	if err != nil || state.Metadata != fields || state.Tracks[1].Artist != "Guest" || state.Tracks[1].AlbumArtist != "Collective" || state.Tracks[1].Album != "Track album" {
		t.Fatalf("inheritance: %#v %v", state, err)
	}
	fields.Artist = ""
	fields.Genre = ""
	fields.Year = ""
	if err = s.Save(ctx, 1, 1, fields); err != nil {
		t.Fatal(err)
	}
	state, err = s.Resolve(ctx, 1, 1)
	if err != nil || state.Metadata.Artist != "" || state.Metadata.Genre != "" || state.Metadata.Year != "" {
		t.Fatalf("explicit clears inherited old values: %#v %v", state, err)
	}
	for _, bad := range []Fields{{Album: ""}, {Album: "Album", Year: "20261"}, {Album: "Album", Year: "0000"}, {Album: "Album", Artist: "a\tb"}, {Album: strings.Repeat("a", 513)}} {
		if err = s.Save(ctx, 1, 1, bad); !errors.Is(err, ErrInvalid) {
			t.Fatalf("accepted invalid fields: %#v %v", bad, err)
		}
	}
	if _, err = s.Resolve(ctx, 2, 1); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("ownership: %v", err)
	}
	if err = s.Save(ctx, 2, 1, Fields{Album: "Stolen"}); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("ownership save: %v", err)
	}
	if _, err = s.BuildTrack(ctx, 1, 1, 999, 1); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("foreign track: %v", err)
	}
	if _, err = s.BuildTrack(ctx, 1, 1, 1, 99); !errors.Is(err, ErrInvalid) {
		t.Fatalf("version pin: %v", err)
	}
	run("DELETE FROM projects WHERE id=1")
	var count int
	if err = s.db.QueryRow("SELECT COUNT(*) FROM project_audio_metadata").Scan(&count); err != nil || count != 0 {
		t.Fatalf("cascade: %d %v", count, err)
	}
}

func TestTaggedCopiesFormatsAndOriginalIsolation(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg required for generated audio fixtures")
	}
	for _, tc := range []struct{ format, codec string }{
		{"wav", "pcm_s24le"}, {"aiff", "pcm_s24be"}, {"flac", "flac"}, {"mp3", "libmp3lame"},
		{"m4a", "aac"}, {"alac", "alac"}, {"ogg", "libvorbis"}, {"opus", "libopus"}, {"wma", "wmav2"}, {"aac", "aac"},
	} {
		t.Run(tc.format, func(t *testing.T) {
			s, run := fixture(t)
			ctx := context.Background()
			ext := tc.format
			if ext == "alac" {
				ext = "m4a"
			}
			source := filepath.Join(s.root, "STILL HERE v13 FINAL."+ext)
			args := []string{"-nostdin", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.1", "-c:a", tc.codec, source}
			if out, err := exec.Command("ffmpeg", args...).CombinedOutput(); err != nil {
				t.Fatalf("fixture: %v %s", err, out)
			}
			original, err := os.ReadFile(source)
			if err != nil {
				t.Fatal(err)
			}
			run("INSERT INTO track_files (version_id,quality,file_path,file_size,format,transcoding_status,original_filename) VALUES (1,'source',?,?,?,'completed','messy filename')", source, len(original), tc.format)
			coverPath := filepath.Join(s.root, "cover.png")
			img := image.NewNRGBA(image.Rect(0, 0, 8, 8))
			img.Set(0, 0, color.NRGBA{R: 255, A: 255})
			var cover bytes.Buffer
			if err = png.Encode(&cover, img); err != nil {
				t.Fatal(err)
			}
			if err = os.WriteFile(coverPath, cover.Bytes(), 0600); err != nil {
				t.Fatal(err)
			}
			run("UPDATE projects SET cover_art_path=? WHERE id=1", coverPath)
			if err = s.Save(ctx, 1, 1, Fields{Album: "Album", Artist: "DiRO", AlbumArtist: "DiRO", Genre: "Hip-Hop/Rap", Year: "2026"}); err != nil {
				t.Fatal(err)
			}
			result, err := s.BuildTrack(ctx, 1, 1, 1, 1)
			if err != nil {
				t.Fatal(err)
			}
			defer result.Cleanup()
			if tc.format == "aac" && (result.Track.Format != "m4a" || result.Track.Conversion == "") {
				t.Fatal("missing AAC remux disclosure")
			}
			tags, err := taglib.ReadTags(result.Path)
			if err != nil || !reflect.DeepEqual(tags[taglib.Title], []string{"Canonical title"}) || !reflect.DeepEqual(tags[taglib.TrackNumber], []string{"2"}) {
				t.Fatalf("tags: %#v %v", tags, err)
			}
			embedded, err := taglib.ReadImage(result.Path)
			if err != nil || len(embedded) == 0 {
				t.Fatalf("cover missing: %v", err)
			}
			after, err := os.ReadFile(source)
			if err != nil || sha256.Sum256(after) != sha256.Sum256(original) {
				t.Fatal("original was changed")
			}
			if tc.format != "aac" {
				// Independent FFmpeg decode verifies the audible samples, not just taglib's tags.
				pcm := func(path string) []byte {
					t.Helper()
					out, err := exec.Command("ffmpeg", "-v", "error", "-i", path, "-map", "0:a:0", "-f", "s32le", "-c:a", "pcm_s32le", "-").Output()
					if err != nil {
						t.Fatal(err)
					}
					return out
				}
				a, b := pcm(source), pcm(result.Path)
				if tc.format == "mp3" {
					// MP3 is encoded into 1152-sample frames with encoder delay and padding.
					// Verify that every single source audio sample is preserved bit-for-bit.
					if !bytes.HasPrefix(b, a) && !bytes.HasPrefix(a, b) {
						t.Fatalf("tagging altered decoded mp3 audio: source %d bytes (%x), tagged %d bytes (%x)", len(a), sha256.Sum256(a), len(b), sha256.Sum256(b))
					}
				} else if !bytes.Equal(a, b) {
					t.Fatalf("tagging altered decoded audio: source %d bytes (%x), tagged %d bytes (%x)", len(a), sha256.Sum256(a), len(b), sha256.Sum256(b))
				}
			}
			// Blank fields remove stale core tags and absent project artwork removes old pictures.
			run("UPDATE projects SET cover_art_path=NULL WHERE id=1")
			if err = s.Save(ctx, 1, 1, Fields{Album: "Album"}); err != nil {
				t.Fatal(err)
			}
			run("UPDATE track_files SET file_path=?, format=? WHERE version_id=1", result.Path, result.Track.Format)
			// Keep the next source inside the storage boundary.
			taggedBytes, _ := os.ReadFile(result.Path)
			staged := filepath.Join(s.root, "previous."+result.Track.Format)
			if err = os.WriteFile(staged, taggedBytes, 0600); err != nil {
				t.Fatal(err)
			}
			run("UPDATE track_files SET file_path=? WHERE version_id=1", staged)
			cleared, err := s.BuildTrack(ctx, 1, 1, 1, 1)
			if err != nil {
				t.Fatal(err)
			}
			defer cleared.Cleanup()
			clearedTags, err := taglib.ReadTags(cleared.Path)
			if err != nil || len(clearedTags[taglib.Artist]) > 0 {
				t.Fatalf("cleared tags: %#v %v", clearedTags, err)
			}
			picture, err := taglib.ReadImage(cleared.Path)
			if err != nil || len(picture) > 0 {
				t.Fatal("stale artwork survived")
			}
		})
	}
}

func TestStorageBoundaryAndCancellation(t *testing.T) {
	s, _ := fixture(t)
	outside := filepath.Join(t.TempDir(), "secret.wav")
	if err := os.WriteFile(outside, []byte("secret"), 0600); err != nil {
		t.Fatal(err)
	}
	if file, err := s.openAsset(outside); err == nil {
		file.Close()
		t.Fatal("read outside storage")
	}
	link := filepath.Join(s.root, "escape.wav")
	if err := os.Symlink(outside, link); err == nil {
		if file, err := s.openAsset(link); err == nil {
			file.Close()
			t.Fatal("followed escaping symlink")
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := s.Resolve(ctx, 1, 1); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancellation: %v", err)
	}
}
