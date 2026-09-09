package service

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	sqlc "bungleware/vault/internal/db/sqlc"
)

func TestPreferredRelativeKey(t *testing.T) {
	for _, test := range []struct{ key, preference, want string }{
		{"C major", "minor", "A minor"}, {"A minor", "major", "C major"},
		{"D major", "minor", "B minor"}, {"E major", "minor", "C# minor"},
		{"F major", "minor", "D minor"}, {"G major", "minor", "E minor"},
		{"A major", "minor", "F# minor"}, {"B major", "minor", "G# minor"},
		{"Db major", "minor", "Bb minor"}, {"Eb major", "minor", "C minor"},
		{"F# major", "minor", "D# minor"}, {"Gb major", "minor", "Eb minor"},
		{"Ab major", "minor", "F minor"}, {"Bb major", "minor", "G minor"},
		{"C# major", "minor", "A# minor"}, {"D# minor", "major", "F# major"},
		{"C minor", "major", "Eb major"}, {"F minor", "major", "Ab major"},
		{"G minor", "major", "Bb major"}, {"Bb minor", "major", "Db major"},
		{"C major", "detected", "C major"}, {"C major", "", "C major"},
		{"C major", "major", "C major"}, {"A minor", "minor", "A minor"},
		{"C major", "invalid", "C major"}, {"unknown", "minor", "unknown"},
		{"C dorian", "minor", "C dorian"}, {"H major", "minor", "H major"},
	} {
		t.Run(test.key+"/"+test.preference, func(t *testing.T) {
			if got := preferredRelativeKey(test.key, test.preference); got != test.want {
				t.Fatalf("got %q, want %q", got, test.want)
			}
		})
	}
}

type analysisQueries struct {
	preference string
	readErr    error
	writeErr   error
	userID     int64
	saved      *sqlc.UpdateTrackAnalysisParams
}

func (q *analysisQueries) GetUserPreferences(_ context.Context, userID int64) (sqlc.UserPreference, error) {
	q.userID = userID
	return sqlc.UserPreference{KeyModePreference: q.preference}, q.readErr
}

func (q *analysisQueries) UpdateTrackAnalysis(_ context.Context, params sqlc.UpdateTrackAnalysisParams) error {
	q.saved = &params
	return q.writeErr
}

func TestAnalyzeTrackAppliesPreferenceBeforeSaving(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/analyze" {
			t.Errorf("unexpected path %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"bpm":120,"key_string":"C major"}`))
	}))
	defer server.Close()
	t.Setenv("AUDIO_ANALYSIS_URL", server.URL)
	for _, mode := range []string{"detected", "minor", "major"} {
		q := &analysisQueries{preference: mode}
		got, err := AnalyzeTrack(context.Background(), q, 12, 9, "original.wav")
		if err != nil {
			t.Fatal(err)
		}
		want := "C major"
		if mode == "minor" {
			want = "A minor"
		}
		if got.Key != want || got.BPM != 120 || q.userID != 9 || q.saved.ID != 12 || q.saved.Key.String != want {
			t.Fatalf("mode %q: response %+v, saved %+v, user %d", mode, got, q.saved, q.userID)
		}
	}
	q := &analysisQueries{readErr: sql.ErrNoRows}
	if got, err := AnalyzeTrack(context.Background(), q, 12, 9, "original.wav"); err != nil || got.Key != "C major" {
		t.Fatalf("missing preferences should preserve detection: %+v, %v", got, err)
	}
	q = &analysisQueries{readErr: errors.New("db unavailable")}
	if _, err := AnalyzeTrack(context.Background(), q, 12, 9, "original.wav"); err == nil || q.saved != nil {
		t.Fatal("database failure must not silently save an unpreferred key")
	}
	q = &analysisQueries{writeErr: errors.New("write failed")}
	if _, err := AnalyzeTrack(context.Background(), q, 12, 9, "original.wav"); err == nil {
		t.Fatal("write failure must be reported")
	}
}
