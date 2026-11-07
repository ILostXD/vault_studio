package audiometadata

import (
	"archive/zip"
	"bytes"
	"context"
	"database/sql"
	"errors"
	"image"
	"image/color"
	"image/png"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"go.senan.xyz/taglib"
)

func albumFixture(t *testing.T) (*Service, func(string, ...any)) {
	t.Helper()
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg required")
	}
	s, run := fixture(t)
	source := filepath.Join(s.root, "master.flac")
	if out, err := exec.Command("ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=duration=0.1", source).CombinedOutput(); err != nil {
		t.Fatalf("%v %s", err, out)
	}
	run("INSERT INTO track_files(version_id,quality,file_path,file_size,format,transcoding_status) VALUES (1,'source',?,100,'flac','completed'),(2,'source',?,100,'flac','completed')", source, source)
	return s.WithLibraryRoot(t.TempDir()), run
}

func TestAlbumDownloadAndLibraryPublication(t *testing.T) {
	s, run := albumFixture(t)
	ctx := context.Background()
	state, err := s.Resolve(ctx, 1, 1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.BuildAlbum(ctx, 2, 1, state.Revision); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("ownership: %v", err)
	}
	if _, err = s.BuildAlbum(ctx, 1, 1, "stale"); !errors.Is(err, ErrInvalid) {
		t.Fatalf("stale: %v", err)
	}
	archive, err := s.BuildAlbum(ctx, 1, 1, state.Revision)
	if err != nil {
		t.Fatal(err)
	}
	defer archive.Cleanup()
	reader, err := zip.OpenReader(archive.Path)
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	if len(reader.File) != 2 || reader.File[0].Name != "01 - First.flac" {
		t.Fatalf("album order: %v", reader.File)
	}
	status, err := s.Publish(ctx, 1, 1, state.Revision)
	if err != nil || !status.Current || status.PublishedAt == "" {
		t.Fatalf("publish: %#v %v", status, err)
	}
	root, err := os.OpenRoot(s.libraryRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer root.Close()
	manifest, err := readManifest(root, status.Folder, 1, 1)
	if err != nil || len(manifest.Tracks) != 2 || len(manifest.Files) != 2 {
		t.Fatalf("manifest: %#v %v", manifest, err)
	}
	run("UPDATE tracks SET title='New title' WHERE id=1")
	updated, err := s.Resolve(ctx, 1, 1)
	if err != nil || updated.Library.Current {
		t.Fatalf("stale publication: %#v %v", updated, err)
	}
	if _, err = s.Publish(ctx, 1, 1, state.Revision); !errors.Is(err, ErrInvalid) {
		t.Fatalf("stale publish: %v", err)
	}
	if _, err = s.Publish(ctx, 1, 1, updated.Revision); err != nil {
		t.Fatal(err)
	}
	if _, err = root.Stat(filepath.Join(status.Folder, "02 - Canonical_title.flac")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("old track left behind: %v", err)
	}
	if err = root.WriteFile(filepath.Join(status.Folder, "do-not-delete.txt"), []byte("mine"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Publish(ctx, 1, 1, updated.Revision); !errors.Is(err, ErrInvalid) {
		t.Fatalf("overwrote unmanaged file: %v", err)
	}
	if _, err = root.Stat(filepath.Join(status.Folder, "do-not-delete.txt")); err != nil {
		t.Fatal(err)
	}
}

func TestLibraryRefusesCollisionsSymlinksAndModifiedFiles(t *testing.T) {
	s, _ := albumFixture(t)
	ctx := context.Background()
	state, err := s.Resolve(ctx, 1, 1)
	if err != nil {
		t.Fatal(err)
	}
	folder := filepath.Join(s.libraryRoot, libraryFolder(1, 1))
	if err = os.Mkdir(folder, 0755); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Publish(ctx, 1, 1, state.Revision); !errors.Is(err, ErrInvalid) {
		t.Fatalf("collision: %v", err)
	}
	if err = os.Remove(folder); err != nil {
		t.Fatal(err)
	}
	if err = os.Symlink(t.TempDir(), folder); err == nil {
		if _, err = s.Publish(ctx, 1, 1, state.Revision); !errors.Is(err, ErrInvalid) {
			t.Fatalf("symlink: %v", err)
		}
		if err = os.Remove(folder); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = s.Publish(ctx, 1, 1, state.Revision); err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(filepath.Join(folder, "01 - First.flac"), []byte("edited externally"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Publish(ctx, 1, 1, state.Revision); !errors.Is(err, ErrInvalid) {
		t.Fatalf("modified file: %v", err)
	}
	if st := s.libraryStatus(1, 1, state.Revision); st.Current || st.Problem == "" {
		t.Fatalf("status should flag the externally edited folder: %#v", st)
	}
}

func TestAlbumMissingSourceAndDisabledLibrary(t *testing.T) {
	s, run := albumFixture(t)
	ctx := context.Background()
	state, _ := s.Resolve(ctx, 1, 1)
	s.WithLibraryRoot("")
	if _, err := s.Publish(ctx, 1, 1, state.Revision); !errors.Is(err, ErrInvalid) {
		t.Fatalf("disabled: %v", err)
	}
	s.WithLibraryRoot(s.root)
	if _, err := s.Publish(ctx, 1, 1, state.Revision); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("source storage destination: %v", err)
	}
	run("DELETE FROM track_files WHERE version_id=2")
	state, _ = s.Resolve(ctx, 1, 1)
	if _, err := s.BuildAlbum(ctx, 1, 1, state.Revision); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("partial album: %v", err)
	}
}

func TestMP3SelectionMatchesAdvertisedBitrate(t *testing.T) {
	s, _ := albumFixture(t)
	ctx := context.Background()
	if _, err := s.Resolve(ctx, 1, 1, "invented"); !errors.Is(err, ErrInvalid) {
		t.Fatalf("invalid format accepted: %v", err)
	}
	result, err := s.BuildTrack(ctx, 1, 1, 1, 1, "mp3")
	if err != nil {
		t.Fatal(err)
	}
	defer result.Cleanup()
	output, err := exec.Command("ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=bit_rate", "-of", "csv=p=0", result.Path).Output()
	if err != nil || string(output) != "320000\n" {
		t.Fatalf("expected 320 kbps MP3: %s %v", output, err)
	}
}

func TestAlbumDownloadAndPublicationWithWAVTracks(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg required")
	}
	s, run := fixture(t)
	s.WithLibraryRoot(t.TempDir())
	ctx := context.Background()

	source1 := filepath.Join(s.root, "first.wav")
	if out, err := exec.Command("ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.1", "-c:a", "pcm_s24le", source1).CombinedOutput(); err != nil {
		t.Fatalf("%v %s", err, out)
	}
	source2 := filepath.Join(s.root, "second.wav")
	if out, err := exec.Command("ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=880:duration=0.1", "-c:a", "pcm_s24le", source2).CombinedOutput(); err != nil {
		t.Fatalf("%v %s", err, out)
	}
	run("INSERT INTO track_files(version_id,quality,file_path,file_size,format,transcoding_status) VALUES (1,'source',?,200,'wav','completed'),(2,'source',?,200,'wav','completed')", source1, source2)

	coverPath := filepath.Join(s.root, "cover.png")
	img := image.NewNRGBA(image.Rect(0, 0, 8, 8))
	img.Set(0, 0, color.NRGBA{R: 255, A: 255})
	var cover bytes.Buffer
	if err := png.Encode(&cover, img); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(coverPath, cover.Bytes(), 0600); err != nil {
		t.Fatal(err)
	}
	run("UPDATE projects SET cover_art_path=? WHERE id=1", coverPath)

	state, err := s.Resolve(ctx, 1, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(state.Tracks) != 2 {
		t.Fatalf("expected 2 tracks, got %d", len(state.Tracks))
	}
	for _, tr := range state.Tracks {
		if tr.Format != "flac" || tr.SourceFormat != "wav" {
			t.Fatalf("expected wav to convert to flac: %#v", tr)
		}
		if !strings.Contains(tr.Conversion, "FLAC") {
			t.Fatalf("missing FLAC conversion notice: %#v", tr)
		}
	}

	archive, err := s.BuildAlbum(ctx, 1, 1, state.Revision)
	if err != nil {
		t.Fatal(err)
	}
	defer archive.Cleanup()

	reader, err := zip.OpenReader(archive.Path)
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()

	if len(reader.File) != 3 {
		t.Fatalf("expected 3 entries in zip, got %d", len(reader.File))
	}
	fileNames := map[string]bool{}
	for _, f := range reader.File {
		fileNames[f.Name] = true
	}
	if !fileNames["01 - First.flac"] || !fileNames["02 - Canonical_title.flac"] || !fileNames["cover.png"] {
		t.Fatalf("unexpected zip contents: %v", fileNames)
	}

	status, err := s.Publish(ctx, 1, 1, state.Revision)
	if err != nil || !status.Current || status.PublishedAt == "" {
		t.Fatalf("publish failed: %#v %v", status, err)
	}

	root, err := os.OpenRoot(s.libraryRoot)
	if err != nil {
		t.Fatal(err)
	}
	defer root.Close()

	for _, name := range []string{"01 - First.flac", "02 - Canonical_title.flac"} {
		pubPath := filepath.Join(s.libraryRoot, status.Folder, name)
		tags, err := taglib.ReadTags(pubPath)
		if err != nil {
			t.Fatalf("failed reading published tags for %s: %v", name, err)
		}
		if len(tags[taglib.Title]) == 0 {
			t.Fatalf("missing title in %s", name)
		}
		pic, err := taglib.ReadImage(pubPath)
		if err != nil || len(pic) == 0 {
			t.Fatalf("missing embedded cover in published %s: %v", name, err)
		}
	}
}

func TestAlbumDownloadAndPublicationWithTargetFormatMP3(t *testing.T) {
	s, run := albumFixture(t)
	ctx := context.Background()

	source1 := filepath.Join(s.root, "master1.wav")
	source2 := filepath.Join(s.root, "master2.wav")
	for _, path := range []string{source1, source2} {
		cmd := exec.Command("ffmpeg", "-nostdin", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.1", "-c:a", "pcm_s16le", path)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("ffmpeg failed: %v: %s", err, out)
		}
	}

	run("UPDATE track_files SET file_path=?, format='wav' WHERE version_id=1", source1)
	run("UPDATE track_files SET file_path=?, format='wav' WHERE version_id=2", source2)

	coverPath := filepath.Join(s.root, "cover.png")
	img := image.NewNRGBA(image.Rect(0, 0, 8, 8))
	img.Set(0, 0, color.NRGBA{R: 255, A: 255})
	var cover bytes.Buffer
	if err := png.Encode(&cover, img); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(coverPath, cover.Bytes(), 0600); err != nil {
		t.Fatal(err)
	}
	run("UPDATE projects SET cover_art_path=? WHERE id=1", coverPath)

	defaultState, err := s.Resolve(ctx, 1, 1)
	if err != nil {
		t.Fatal(err)
	}
	if !defaultState.HasLossless || len(defaultState.AvailableFormats) != 2 || defaultState.TargetFormat != "flac" {
		t.Fatalf("unexpected default state: %#v", defaultState)
	}

	mp3State, err := s.Resolve(ctx, 1, 1, "mp3")
	if err != nil {
		t.Fatal(err)
	}
	if mp3State.TargetFormat != "mp3" {
		t.Fatalf("expected target format mp3, got %s", mp3State.TargetFormat)
	}
	for _, tr := range mp3State.Tracks {
		if tr.Format != "mp3" || tr.SourceFormat != "wav" {
			t.Fatalf("expected wav to convert to mp3: %#v", tr)
		}
		if !strings.Contains(tr.Conversion, "MP3") {
			t.Fatalf("missing MP3 conversion notice: %#v", tr)
		}
	}

	archive, err := s.BuildAlbum(ctx, 1, 1, mp3State.Revision, "mp3")
	if err != nil {
		t.Fatal(err)
	}
	defer archive.Cleanup()

	reader, err := zip.OpenReader(archive.Path)
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()

	if len(reader.File) != 3 {
		t.Fatalf("expected 3 entries in zip, got %d", len(reader.File))
	}
	fileNames := map[string]bool{}
	for _, f := range reader.File {
		fileNames[f.Name] = true
	}
	if !fileNames["01 - First.mp3"] || !fileNames["02 - Canonical_title.mp3"] || !fileNames["cover.png"] {
		t.Fatalf("unexpected zip contents: %v", fileNames)
	}
}

func TestLossySourceOnlyAllowsLossyExport(t *testing.T) {
	s, run := albumFixture(t)
	ctx := context.Background()

	source := filepath.Join(s.root, "master.mp3")
	cmd := exec.Command("ffmpeg", "-nostdin", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.1", "-c:a", "libmp3lame", source)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("ffmpeg failed: %v: %s", err, out)
	}

	run("UPDATE track_files SET file_path=?, format='mp3' WHERE version_id IN (1, 2)", source)

	state, err := s.Resolve(ctx, 1, 1)
	if err != nil {
		t.Fatal(err)
	}
	if state.HasLossless {
		t.Fatal("expected has_lossless to be false")
	}
	if len(state.AvailableFormats) != 1 || state.AvailableFormats[0] != "mp3" {
		t.Fatalf("expected only mp3 available, got: %v", state.AvailableFormats)
	}

	// Requesting FLAC on a lossy-only project must NOT yield FLAC
	if _, err := s.Resolve(ctx, 1, 1, "flac"); !errors.Is(err, ErrInvalid) {
		t.Fatalf("expected refusal of FLAC upconversion, got %v", err)
	}
}
