package audiometadata

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

func TestResolveCachesProbes(t *testing.T) {
	if _, err := exec.LookPath("ffprobe"); err != nil {
		t.Skip("ffprobe required")
	}
	s, run := fixture(t)
	src := filepath.Join(s.root, "a.wav")
	if out, err := exec.Command("ffmpeg", "-nostdin", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.1", "-c:a", "pcm_s24le", src).CombinedOutput(); err != nil {
		t.Fatal(err, string(out))
	}
	data, _ := os.ReadFile(src)
	for id := 1; id <= 2; id++ {
		p := filepath.Join(s.root, fmt.Sprintf("t%d.wav", id))
		if err := os.WriteFile(p, data, 0600); err != nil {
			t.Fatal(err)
		}
		run("INSERT INTO track_files (version_id,quality,file_path,file_size,format,transcoding_status,original_filename) VALUES (?,'source',?,?,'wav','completed','x.wav')", id, p, len(data))
	}
	if _, err := s.Resolve(context.Background(), 1, 1); err != nil {
		t.Fatal(err)
	}
	// With ffprobe gone, a second Resolve only succeeds if every probe came from the cache.
	t.Setenv("PATH", "")
	start := time.Now()
	state, err := s.Resolve(context.Background(), 1, 1)
	if err != nil || len(state.Tracks) != 2 || state.Tracks[0].Format != "flac" {
		t.Fatalf("cached resolve: %#v %v", state.Tracks, err)
	}
	if time.Since(start) > time.Second {
		t.Fatal("resolve still slow with warm cache")
	}
}
