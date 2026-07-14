package service

import (
	"context"
	"database/sql"

	sqlc "bungleware/vault/internal/db/sqlc"
	"bungleware/vault/internal/transcoding"
)

type trackAnalysisUpdater interface {
	UpdateTrackAnalysis(context.Context, sqlc.UpdateTrackAnalysisParams) error
}

type TrackAnalysis struct {
	BPM int    `json:"bpm"`
	Key string `json:"key"`
}

func AnalyzeTrack(ctx context.Context, queries trackAnalysisUpdater, trackID int64, filePath string) (TrackAnalysis, error) {
	bpm, key, err := transcoding.AnalyzeAudio(ctx, filePath)
	if err != nil {
		return TrackAnalysis{}, err
	}

	if err := queries.UpdateTrackAnalysis(ctx, sqlc.UpdateTrackAnalysisParams{
		Bpm: sql.NullInt64{Int64: int64(bpm), Valid: true},
		Key: sql.NullString{String: key, Valid: true},
		ID:  trackID,
	}); err != nil {
		return TrackAnalysis{}, err
	}

	return TrackAnalysis{BPM: bpm, Key: key}, nil
}
