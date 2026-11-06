package handlers

import (
	"database/sql"
	"errors"
	"mime"
	"net/http"
	"os"
	"strconv"

	"bungleware/vault/internal/apperr"
	"bungleware/vault/internal/audiometadata"
	"bungleware/vault/internal/httputil"
)

type AudioMetadataHandler struct{ service *audiometadata.Service }

func NewAudioMetadataHandler(service *audiometadata.Service) *AudioMetadataHandler {
	return &AudioMetadataHandler{service: service}
}

func (h *AudioMetadataHandler) Get(w http.ResponseWriter, r *http.Request) error {
	userID, projectID, err := distributionIDs(r)
	if err != nil {
		return err
	}
	format := r.URL.Query().Get("format")
	state, err := h.service.Resolve(r.Context(), userID, projectID, format)
	if err != nil {
		return audioMetadataError(err)
	}
	return httputil.OKResult(w, state)
}

func (h *AudioMetadataHandler) Save(w http.ResponseWriter, r *http.Request) error {
	userID, projectID, err := distributionIDs(r)
	if err != nil {
		return err
	}
	format := r.URL.Query().Get("format")
	r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
	fields, err := httputil.DecodeJSON[audiometadata.Fields](r)
	if err != nil {
		return apperr.NewBadRequest("invalid project metadata")
	}
	if err = h.service.Save(r.Context(), userID, projectID, fields); err != nil {
		return audioMetadataError(err)
	}
	state, err := h.service.Resolve(r.Context(), userID, projectID, format)
	if err != nil {
		return audioMetadataError(err)
	}
	return httputil.OKResult(w, state)
}

func (h *AudioMetadataHandler) Download(w http.ResponseWriter, r *http.Request) error {
	userID, projectID, err := distributionIDs(r)
	if err != nil {
		return err
	}
	trackID, err := httputil.PathInt64(r, "trackId")
	if err != nil {
		return err
	}
	versionID, err := strconv.ParseInt(r.URL.Query().Get("version_id"), 10, 64)
	if err != nil || versionID <= 0 {
		return apperr.NewBadRequest("a previewed version_id is required")
	}
	// Avoid generating a second copy for native download filename probes.
	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return nil
	}
	format := r.URL.Query().Get("format")
	export, err := h.service.BuildTrack(r.Context(), userID, projectID, trackID, versionID, format)
	if err != nil {
		return audioMetadataError(err)
	}
	return serveAudioExport(w, r, export)
}

func (h *AudioMetadataHandler) DownloadAlbum(w http.ResponseWriter, r *http.Request) error {
	userID, projectID, err := distributionIDs(r)
	if err != nil {
		return err
	}
	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return nil
	}
	format := r.URL.Query().Get("format")
	export, err := h.service.BuildAlbum(r.Context(), userID, projectID, r.URL.Query().Get("revision"), format)
	if err != nil {
		return audioMetadataError(err)
	}
	return serveAudioExport(w, r, export)
}

func (h *AudioMetadataHandler) Publish(w http.ResponseWriter, r *http.Request) error {
	userID, projectID, err := distributionIDs(r)
	if err != nil {
		return err
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	request, err := httputil.DecodeJSON[struct {
		Revision string `json:"revision"`
		Format   string `json:"format"`
	}](r)
	if err != nil {
		return apperr.NewBadRequest("invalid album revision")
	}
	status, err := h.service.Publish(r.Context(), userID, projectID, request.Revision, request.Format)
	if err != nil {
		return audioMetadataError(err)
	}
	return httputil.OKResult(w, status)
}

func serveAudioExport(w http.ResponseWriter, r *http.Request, export *audiometadata.Export) error {
	defer export.Cleanup()
	file, err := os.Open(export.Path)
	if err != nil {
		return audioMetadataError(err)
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return audioMetadataError(err)
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": export.Filename}))
	http.ServeContent(w, r, export.Filename, info.ModTime(), file)
	return nil
}

func audioMetadataError(err error) error {
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return apperr.NewNotFound("project or track not found")
	case errors.Is(err, audiometadata.ErrInvalid), errors.Is(err, audiometadata.ErrUnsupported):
		return apperr.NewBadRequest(err.Error())
	case errors.Is(err, audiometadata.ErrUnavailable):
		return apperr.NewBadRequest(err.Error())
	case errors.Is(err, audiometadata.ErrBusy):
		return apperr.New(http.StatusServiceUnavailable, err, err.Error())
	default:
		return apperr.NewInternal("could not prepare audio metadata", err)
	}
}
