package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	sqlc "bungleware/vault/internal/db/sqlc"
	"bungleware/vault/internal/storage"
)

type MotionAssetKind string

const (
	MotionAssetAppleSquare   MotionAssetKind = "apple_square"
	MotionAssetApplePortrait MotionAssetKind = "apple_portrait"
	MotionAssetSpotifyCanvas MotionAssetKind = "spotify_canvas"
)

var allowedMotionExtensions = map[string]string{
	".mp4": "video/mp4",
	".mov": "video/quicktime",
}

type UploadMotionAssetInput struct {
	UserID   int64
	PublicID string
	Kind     MotionAssetKind
	Filename string
	Reader   io.Reader
}

type MotionAssetStream struct {
	Reader    storage.ReadSeekCloser
	Size      int64
	MimeType  string
	UpdatedAt time.Time
}

type motionProbe struct {
	Format struct {
		Duration string `json:"duration"`
		BitRate  string `json:"bit_rate"`
	} `json:"format"`
	Streams []struct {
		CodecType    string `json:"codec_type"`
		CodecName    string `json:"codec_name"`
		Width        int64  `json:"width"`
		Height       int64  `json:"height"`
		AvgFrameRate string `json:"avg_frame_rate"`
	} `json:"streams"`
}

type motionMetadata struct {
	Width           int64
	Height          int64
	DurationSeconds float64
	Codec           string
	FrameRate       float64
	Bitrate         int64
	HasAudio        bool
}

func ParseMotionAssetKind(value string) (MotionAssetKind, error) {
	kind := MotionAssetKind(value)
	switch kind {
	case MotionAssetAppleSquare, MotionAssetApplePortrait, MotionAssetSpotifyCanvas:
		return kind, nil
	default:
		return "", errors.New("unsupported motion artwork type")
	}
}

func (s *projectService) UploadMotionAsset(ctx context.Context, input UploadMotionAssetInput) (sqlc.ProjectMotionAsset, error) {
	project, err := s.checkProjectEditPermission(ctx, input.PublicID, input.UserID)
	if err != nil {
		return sqlc.ProjectMotionAsset{}, err
	}

	ext := strings.ToLower(filepath.Ext(input.Filename))
	sourceMime, ok := allowedMotionExtensions[ext]
	if !ok {
		return sqlc.ProjectMotionAsset{}, errors.New("motion artwork must be an MP4 or MOV file")
	}

	sourceFile, err := os.CreateTemp("", "vault-motion-source-*"+ext)
	if err != nil {
		return sqlc.ProjectMotionAsset{}, err
	}
	sourcePath := sourceFile.Name()
	defer os.Remove(sourcePath)
	if _, err := io.Copy(sourceFile, input.Reader); err != nil {
		sourceFile.Close()
		return sqlc.ProjectMotionAsset{}, fmt.Errorf("failed to stage motion artwork: %w", err)
	}
	if err := sourceFile.Close(); err != nil {
		return sqlc.ProjectMotionAsset{}, err
	}

	metadata, err := probeMotionAsset(ctx, sourcePath)
	if err != nil {
		return sqlc.ProjectMotionAsset{}, err
	}

	previewFile, err := os.CreateTemp("", "vault-motion-preview-*.mp4")
	if err != nil {
		return sqlc.ProjectMotionAsset{}, err
	}
	previewPath := previewFile.Name()
	previewFile.Close()
	defer os.Remove(previewPath)

	if err := buildMotionPreview(ctx, sourcePath, previewPath); err != nil {
		return sqlc.ProjectMotionAsset{}, err
	}

	sourceReader, err := os.Open(sourcePath)
	if err != nil {
		return sqlc.ProjectMotionAsset{}, err
	}
	defer sourceReader.Close()
	previewReader, err := os.Open(previewPath)
	if err != nil {
		return sqlc.ProjectMotionAsset{}, err
	}
	defer previewReader.Close()

	saved, err := s.storage.SaveProjectMotionAsset(ctx, storage.SaveProjectMotionAssetInput{
		ProjectPublicID: project.PublicID,
		Kind:            string(input.Kind),
		SourceExt:       ext,
		Source:          sourceReader,
		Preview:         previewReader,
	})
	if err != nil {
		return sqlc.ProjectMotionAsset{}, err
	}

	return s.db.UpsertProjectMotionAsset(ctx, sqlc.UpsertProjectMotionAssetParams{
		ProjectID:       project.ID,
		Kind:            string(input.Kind),
		SourcePath:      saved.SourcePath,
		SourceMime:      sourceMime,
		PreviewPath:     saved.PreviewPath,
		PreviewMime:     "video/mp4",
		Width:           metadata.Width,
		Height:          metadata.Height,
		DurationSeconds: metadata.DurationSeconds,
		Codec:           metadata.Codec,
		FrameRate:       metadata.FrameRate,
		Bitrate:         metadata.Bitrate,
		HasAudio:        metadata.HasAudio,
	})
}

func (s *projectService) ListMotionAssets(ctx context.Context, publicID string, userID int64) ([]sqlc.ProjectMotionAsset, error) {
	project, err := s.GetProject(ctx, publicID, userID)
	if err != nil {
		return nil, err
	}
	return s.db.ListProjectMotionAssets(ctx, project.ID)
}

func (s *projectService) DeleteMotionAsset(ctx context.Context, publicID string, userID int64, kind MotionAssetKind) error {
	project, err := s.checkProjectEditPermission(ctx, publicID, userID)
	if err != nil {
		return err
	}
	if err := s.storage.DeleteProjectMotionAsset(ctx, storage.DeleteProjectMotionAssetInput{
		ProjectPublicID: project.PublicID,
		Kind:            string(kind),
	}); err != nil {
		return err
	}
	return s.db.DeleteProjectMotionAsset(ctx, sqlc.DeleteProjectMotionAssetParams{
		ProjectID: project.ID,
		Kind:      string(kind),
	})
}

func (s *projectService) GetMotionAssetStream(ctx context.Context, publicID string, userID int64, kind MotionAssetKind) (*MotionAssetStream, error) {
	project, err := s.GetProject(ctx, publicID, userID)
	if err != nil {
		return nil, err
	}
	asset, err := s.db.GetProjectMotionAsset(ctx, sqlc.GetProjectMotionAssetParams{
		ProjectID: project.ID,
		Kind:      string(kind),
	})
	if err != nil {
		return nil, err
	}
	stream, err := s.storage.OpenProjectMotionAsset(ctx, storage.OpenProjectMotionAssetInput{
		ProjectPublicID: project.PublicID,
		Kind:            string(kind),
		Path:            asset.PreviewPath,
	})
	if err != nil {
		return nil, err
	}
	return &MotionAssetStream{
		Reader:    stream.Reader,
		Size:      stream.Size,
		MimeType:  asset.PreviewMime,
		UpdatedAt: asset.UpdatedAt,
	}, nil
}

func probeMotionAsset(ctx context.Context, path string) (*motionMetadata, error) {
	cmd := exec.CommandContext(ctx, "ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", path)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("unable to inspect motion artwork: %w", err)
	}
	var probe motionProbe
	if err := json.Unmarshal(output, &probe); err != nil {
		return nil, fmt.Errorf("invalid media metadata: %w", err)
	}

	metadata := &motionMetadata{}
	metadata.DurationSeconds, _ = strconv.ParseFloat(probe.Format.Duration, 64)
	metadata.Bitrate, _ = strconv.ParseInt(probe.Format.BitRate, 10, 64)
	for _, stream := range probe.Streams {
		switch stream.CodecType {
		case "video":
			if metadata.Width == 0 {
				metadata.Width = stream.Width
				metadata.Height = stream.Height
				metadata.Codec = stream.CodecName
				metadata.FrameRate = parseFrameRate(stream.AvgFrameRate)
			}
		case "audio":
			metadata.HasAudio = true
		}
	}
	if metadata.Width == 0 || metadata.Height == 0 {
		return nil, errors.New("motion artwork does not contain a video stream")
	}
	return metadata, nil
}

func parseFrameRate(value string) float64 {
	parts := strings.Split(value, "/")
	if len(parts) == 2 {
		numerator, _ := strconv.ParseFloat(parts[0], 64)
		denominator, _ := strconv.ParseFloat(parts[1], 64)
		if denominator != 0 {
			return numerator / denominator
		}
	}
	result, _ := strconv.ParseFloat(value, 64)
	return result
}

func buildMotionPreview(ctx context.Context, sourcePath, previewPath string) error {
	cmd := exec.CommandContext(
		ctx,
		"ffmpeg",
		"-v", "error",
		"-i", sourcePath,
		"-map", "0:v:0",
		"-an",
		"-vf", "scale='min(1080,iw)':-2",
		"-c:v", "libx264",
		"-preset", "fast",
		"-crf", "23",
		"-pix_fmt", "yuv420p",
		"-movflags", "+faststart",
		"-y",
		previewPath,
	)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to create browser preview: %w: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}
