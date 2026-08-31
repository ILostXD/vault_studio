package projects

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"bungleware/vault/internal/apperr"
	sqlc "bungleware/vault/internal/db/sqlc"
	"bungleware/vault/internal/httputil"
	"bungleware/vault/internal/middleware"
	"bungleware/vault/internal/service"
)

const maxMotionArtworkUploadSize = 600 << 20

type motionAssetResponse struct {
	Kind            string  `json:"kind"`
	Width           int64   `json:"width"`
	Height          int64   `json:"height"`
	DurationSeconds float64 `json:"duration_seconds"`
	Codec           string  `json:"codec"`
	FrameRate       float64 `json:"frame_rate"`
	Bitrate         int64   `json:"bitrate"`
	HasAudio        bool    `json:"has_audio"`
	SourceMime      string  `json:"source_mime"`
	UpdatedAt       string  `json:"updated_at"`
}

func motionAssetToResponse(asset sqlc.ProjectMotionAsset) motionAssetResponse {
	return motionAssetResponse{
		Kind:            asset.Kind,
		Width:           asset.Width,
		Height:          asset.Height,
		DurationSeconds: asset.DurationSeconds,
		Codec:           asset.Codec,
		FrameRate:       asset.FrameRate,
		Bitrate:         asset.Bitrate,
		HasAudio:        asset.HasAudio,
		SourceMime:      asset.SourceMime,
		UpdatedAt:       asset.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func (h *ProjectsHandler) ListProjectMotionAssets(w http.ResponseWriter, r *http.Request) error {
	userID, err := httputil.RequireUserID(r)
	if err != nil {
		return apperr.NewUnauthorized("unauthorized")
	}
	assets, err := h.service.ListMotionAssets(r.Context(), r.PathValue("id"), int64(userID))
	if err := httputil.HandleDBError(err, "project not found", "failed to list motion artwork"); err != nil {
		return err
	}
	response := make([]motionAssetResponse, 0, len(assets))
	for _, asset := range assets {
		response = append(response, motionAssetToResponse(asset))
	}
	return httputil.OKResult(w, response)
}

func (h *ProjectsHandler) UploadProjectMotionAsset(w http.ResponseWriter, r *http.Request) error {
	userID, err := httputil.RequireUserID(r)
	if err != nil {
		return apperr.NewUnauthorized("unauthorized")
	}
	kind, err := service.ParseMotionAssetKind(r.PathValue("kind"))
	if err != nil {
		return apperr.NewBadRequest(err.Error())
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxMotionArtworkUploadSize)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		if strings.Contains(err.Error(), "request body too large") {
			return apperr.NewBadRequest("motion artwork exceeds the 600 MB upload limit")
		}
		return apperr.NewBadRequest("failed to parse motion artwork upload")
	}
	defer r.MultipartForm.RemoveAll()

	file, header, err := r.FormFile("asset")
	if err != nil {
		return apperr.NewBadRequest("motion artwork file is required")
	}
	defer file.Close()

	asset, err := h.service.UploadMotionAsset(r.Context(), service.UploadMotionAssetInput{
		UserID:   int64(userID),
		PublicID: r.PathValue("id"),
		Kind:     kind,
		Filename: header.Filename,
		Reader:   file,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return apperr.NewNotFound("project not found")
	}
	if err != nil {
		if strings.Contains(err.Error(), "editing not allowed") {
			return apperr.NewForbidden("editing is not allowed for this project")
		}
		if strings.Contains(err.Error(), "motion artwork") || strings.Contains(err.Error(), "video stream") || strings.Contains(err.Error(), "media metadata") {
			return apperr.NewBadRequest(err.Error())
		}
		return apperr.NewInternal("failed to upload motion artwork", err)
	}

	w.Header().Set("Cache-Control", "no-store")
	return httputil.OKResult(w, motionAssetToResponse(asset))
}

func (h *ProjectsHandler) DeleteProjectMotionAsset(w http.ResponseWriter, r *http.Request) error {
	userID, err := httputil.RequireUserID(r)
	if err != nil {
		return apperr.NewUnauthorized("unauthorized")
	}
	kind, err := service.ParseMotionAssetKind(r.PathValue("kind"))
	if err != nil {
		return apperr.NewBadRequest(err.Error())
	}
	if err := h.service.DeleteMotionAsset(r.Context(), r.PathValue("id"), int64(userID), kind); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return apperr.NewNotFound("project or motion artwork not found")
		}
		if strings.Contains(err.Error(), "editing not allowed") {
			return apperr.NewForbidden("editing is not allowed for this project")
		}
		return apperr.NewInternal("failed to delete motion artwork", err)
	}
	return httputil.NoContentResult(w)
}

func (h *ProjectsHandler) StreamProjectMotionAsset(w http.ResponseWriter, r *http.Request) error {
	userID, err := httputil.RequireUserID(r)
	if err != nil {
		if !middleware.SignedURLValid(r.Context()) {
			return apperr.NewUnauthorized("unauthorized")
		}
		userID, err = strconv.Atoi(r.URL.Query().Get("user_id"))
		if err != nil {
			return apperr.NewUnauthorized("invalid signed media URL")
		}
	}
	kind, err := service.ParseMotionAssetKind(r.PathValue("kind"))
	if err != nil {
		return apperr.NewBadRequest(err.Error())
	}
	stream, err := h.service.GetMotionAssetStream(r.Context(), r.PathValue("id"), int64(userID), kind)
	if err := httputil.HandleDBError(err, "motion artwork not found", "failed to stream motion artwork"); err != nil {
		return err
	}
	defer stream.Reader.Close()
	w.Header().Set("Content-Type", stream.MimeType)
	w.Header().Set("Cache-Control", "private, max-age=300")
	http.ServeContent(w, r, string(kind)+".mp4", stream.UpdatedAt, stream.Reader)
	return nil
}
