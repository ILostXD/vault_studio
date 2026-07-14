package transcoding

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAnalyzeAudio(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/analyze" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"bpm":117,"key":"Ab","scale":"minor","key_string":"Ab minor"}`))
	}))
	t.Cleanup(server.Close)
	t.Setenv("AUDIO_ANALYSIS_URL", server.URL)

	bpm, key, err := AnalyzeAudio(context.Background(), "testdata/source.wav")
	if err != nil {
		t.Fatalf("AnalyzeAudio returned an error: %v", err)
	}
	if bpm != 117 {
		t.Fatalf("expected BPM 117, got %d", bpm)
	}
	if key != "Ab minor" {
		t.Fatalf("expected key Ab minor, got %q", key)
	}
}

func TestAnalyzeAudioCanBeDisabled(t *testing.T) {
	t.Setenv("AUDIO_ANALYSIS_URL", "disabled")

	_, _, err := AnalyzeAudio(context.Background(), "source.wav")
	if !errors.Is(err, ErrAudioAnalysisDisabled) {
		t.Fatalf("expected ErrAudioAnalysisDisabled, got %v", err)
	}
}
