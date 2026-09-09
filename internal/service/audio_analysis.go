package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	sqlc "bungleware/vault/internal/db/sqlc"
	"bungleware/vault/internal/transcoding"
)

type trackAnalysisUpdater interface {
	UpdateTrackAnalysis(context.Context, sqlc.UpdateTrackAnalysisParams) error
	GetUserPreferences(context.Context, int64) (sqlc.UserPreference, error)
}

type TrackAnalysis struct {
	BPM int    `json:"bpm"`
	Key string `json:"key"`
}

func AnalyzeTrack(ctx context.Context, queries trackAnalysisUpdater, trackID, userID int64, filePath string) (TrackAnalysis, error) {
	prefs, err := queries.GetUserPreferences(ctx, userID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return TrackAnalysis{}, fmt.Errorf("load analysis preferences: %w", err)
	}
	bpm, key, err := transcoding.AnalyzeAudio(ctx, filePath)
	if err != nil {
		return TrackAnalysis{}, err
	}
	key = preferredRelativeKey(key, prefs.KeyModePreference)

	if err := queries.UpdateTrackAnalysis(ctx, sqlc.UpdateTrackAnalysisParams{
		Bpm: sql.NullInt64{Int64: int64(bpm), Valid: true},
		Key: sql.NullString{String: key, Valid: true},
		ID:  trackID,
	}); err != nil {
		return TrackAnalysis{}, err
	}

	return TrackAnalysis{BPM: bpm, Key: key}, nil
}

func preferredRelativeKey(key, preference string) string {
	parts := strings.Fields(key)
	if len(parts) != 2 || (preference != "major" && preference != "minor") {
		return key
	}
	mode := strings.ToLower(parts[1])
	if mode == preference || (mode != "major" && mode != "minor") {
		return key
	}
	root := strings.ReplaceAll(strings.ReplaceAll(parts[0], "\u266f", "#"), "\u266d", "b")
	pitches := map[string]int{
		"C": 0, "B#": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
		"E": 4, "Fb": 4, "F": 5, "E#": 5, "F#": 6, "Gb": 6,
		"G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11, "Cb": 11,
	}
	pitch, ok := pitches[root]
	if !ok {
		return key
	}
	// Relative keys share a key signature: minor is three semitones below major.
	if preference == "minor" {
		pitch = (pitch + 9) % 12
	} else {
		pitch = (pitch + 3) % 12
	}
	names := []string{"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"}
	if strings.Contains(root, "b") || (preference == "major" && !strings.Contains(root, "#")) {
		names = []string{"C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"}
	}
	return names[pitch] + " " + preference
}
