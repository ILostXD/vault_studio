package handlers

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"

	"bungleware/vault/internal/apperr"
	"bungleware/vault/internal/distribution"
	"bungleware/vault/internal/httputil"
)

type DistributionHandler struct {
	service *distribution.Service
}

func NewDistributionHandler(service *distribution.Service) *DistributionHandler {
	return &DistributionHandler{service: service}
}

type releasePreparationResponse struct {
	Preparation distribution.Preparation `json:"preparation"`
	Release     distribution.Release     `json:"release"`
	Validation  distribution.Validation  `json:"validation"`
}

func (h *DistributionHandler) GetArtistProfile(w http.ResponseWriter, r *http.Request) error {
	userID, err := distributionUserID(r)
	if err != nil {
		return err
	}
	profile, err := h.service.GetProfile(r.Context(), userID)
	if err != nil {
		return apperr.NewInternal("failed to load artist profile", err)
	}
	return httputil.OKResult(w, profile)
}

func (h *DistributionHandler) SaveArtistProfile(w http.ResponseWriter, r *http.Request) error {
	userID, err := distributionUserID(r)
	if err != nil {
		return err
	}
	profile, err := httputil.DecodeJSON[distribution.ArtistProfile](r)
	if err != nil {
		return apperr.NewBadRequest("invalid artist profile")
	}
	profile, err = h.service.SaveProfile(r.Context(), userID, profile)
	if err != nil {
		return distributionError("save artist profile", err)
	}
	return httputil.OKResult(w, profile)
}

func (h *DistributionHandler) GetPreparation(w http.ResponseWriter, r *http.Request) error {
	userID, projectID, err := distributionIDs(r)
	if err != nil {
		return err
	}
	return h.preparationResponse(w, r, userID, projectID)
}

func (h *DistributionHandler) SavePreparation(w http.ResponseWriter, r *http.Request) error {
	userID, projectID, err := distributionIDs(r)
	if err != nil {
		return err
	}
	preparation, err := httputil.DecodeJSON[distribution.Preparation](r)
	if err != nil {
		return apperr.NewBadRequest("invalid release preparation")
	}
	if _, err = h.service.SavePreparation(r.Context(), userID, projectID, preparation); err != nil {
		return distributionError("save release preparation", err)
	}
	return h.preparationResponse(w, r, userID, projectID)
}

func (h *DistributionHandler) preparationResponse(w http.ResponseWriter, r *http.Request, userID, projectID int64) error {
	preparation, err := h.service.GetPreparation(r.Context(), userID, projectID)
	if err != nil {
		return distributionError("load release preparation", err)
	}
	release, validation, err := h.service.Validate(r.Context(), userID, projectID)
	if err != nil {
		return distributionError("validate release preparation", err)
	}
	return httputil.OKResult(w, releasePreparationResponse{Preparation: preparation, Release: release, Validation: validation})
}

func (h *DistributionHandler) ExportPackage(w http.ResponseWriter, r *http.Request) error {
	userID, projectID, err := distributionIDs(r)
	if err != nil {
		return err
	}
	pkg, _, err := h.service.BuildPackage(r.Context(), userID, projectID)
	if err != nil {
		var validationErr *distribution.ValidationError
		if errors.As(err, &validationErr) {
			httputil.WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{
				"error":      "Release needs attention before it can be exported",
				"validation": validationErr.Validation,
			})
			return nil
		}
		return distributionError("create release package", err)
	}
	defer pkg.Cleanup()
	f, err := os.Open(pkg.Path)
	if err != nil {
		return apperr.NewInternal("open release package", err)
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return apperr.NewInternal("inspect release package", err)
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename=%q`, pkg.Filename))
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	_, err = io.Copy(w, f)
	return err
}

func (h *DistributionHandler) History(w http.ResponseWriter, r *http.Request) error {
	userID, projectID, err := distributionIDs(r)
	if err != nil {
		return err
	}
	history, err := h.service.History(r.Context(), userID, projectID)
	if err != nil {
		return distributionError("load distribution history", err)
	}
	return httputil.OKResult(w, history)
}

func distributionUserID(r *http.Request) (int64, error) {
	userID, err := httputil.RequireUserID(r)
	if err != nil {
		return 0, apperr.NewUnauthorized("unauthorized")
	}
	return int64(userID), nil
}

func distributionIDs(r *http.Request) (int64, int64, error) {
	userID, err := distributionUserID(r)
	if err != nil {
		return 0, 0, err
	}
	projectID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || projectID <= 0 {
		return 0, 0, apperr.NewBadRequest("invalid project id")
	}
	return userID, projectID, nil
}

func distributionError(action string, err error) error {
	switch {
	case errors.Is(err, distribution.ErrNotFound):
		return apperr.NewNotFound("project not found")
	case errors.Is(err, distribution.ErrInvalid):
		return apperr.NewBadRequest(err.Error())
	case errors.Is(err, distribution.ErrAssets):
		return apperr.NewBadRequest(err.Error())
	default:
		return apperr.NewInternal("failed to "+action, err)
	}
}
