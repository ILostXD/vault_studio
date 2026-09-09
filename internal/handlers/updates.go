package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"bungleware/vault/internal/apperr"
	"bungleware/vault/internal/db"
	"bungleware/vault/internal/httputil"
)

const defaultLatestReleaseURL = "https://api.github.com/repos/ILostXD/vault_studio/releases/latest"

type UpdateConfig struct {
	Endpoint         string
	Token            string
	LatestReleaseURL string
}

type UpdateHandler struct {
	db             *db.DB
	currentVersion string
	config         UpdateConfig
	httpClient     *http.Client
}

type githubRelease struct {
	TagName string `json:"tag_name"`
	HTMLURL string `json:"html_url"`
}

func NewUpdateHandler(database *db.DB, currentVersion string, config UpdateConfig) *UpdateHandler {
	if config.LatestReleaseURL == "" {
		config.LatestReleaseURL = defaultLatestReleaseURL
	}
	return &UpdateHandler{
		db:             database,
		currentVersion: currentVersion,
		config:         config,
		httpClient:     &http.Client{Timeout: 15 * time.Second},
	}
}

func (h *UpdateHandler) Status(w http.ResponseWriter, r *http.Request) error {
	if err := h.requireAdmin(r); err != nil {
		return err
	}
	release, err := h.latestRelease(r.Context())
	if err != nil {
		return apperr.NewInternal("failed to check for { vault.studio } updates", err)
	}
	return httputil.OKResult(w, map[string]any{
		"current_version":    h.currentVersion,
		"latest_version":     release.TagName,
		"release_url":        release.HTMLURL,
		"update_available":   newerVersion(release.TagName, h.currentVersion),
		"updater_configured": h.updaterConfigured(),
	})
}

func (h *UpdateHandler) Install(w http.ResponseWriter, r *http.Request) error {
	if err := h.requireAdmin(r); err != nil {
		return err
	}
	if !h.updaterConfigured() {
		return apperr.NewConflict("automatic updates are not configured for this instance")
	}
	go func() {
		time.Sleep(300 * time.Millisecond)
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		if err := h.triggerUpdate(ctx); err != nil {
			slog.Error("automatic update request failed", "error", err)
		}
	}()
	return httputil.OKResult(w, map[string]bool{"started": true})
}

func (h *UpdateHandler) triggerUpdate(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.config.Endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+h.config.Token)
	response, err := h.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return fmt.Errorf("update service returned status %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

func (h *UpdateHandler) requireAdmin(r *http.Request) error {
	userID, err := httputil.RequireUserID(r)
	if err != nil {
		return apperr.NewUnauthorized("unauthorized")
	}
	user, err := h.db.Queries.GetUserByID(r.Context(), int64(userID))
	if err != nil {
		return apperr.NewUnauthorized("unauthorized")
	}
	if !user.IsAdmin {
		return apperr.NewForbidden("admin access required")
	}
	return nil
}

func (h *UpdateHandler) latestRelease(ctx context.Context) (githubRelease, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, h.config.LatestReleaseURL, nil)
	if err != nil {
		return githubRelease{}, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "Vault-Studio")
	response, err := h.httpClient.Do(req)
	if err != nil {
		return githubRelease{}, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return githubRelease{}, fmt.Errorf("GitHub returned status %d", response.StatusCode)
	}
	var release githubRelease
	if err = json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&release); err != nil {
		return release, err
	}
	if release.TagName == "" || release.HTMLURL == "" {
		return release, errors.New("latest release response is incomplete")
	}
	return release, nil
}

func (h *UpdateHandler) updaterConfigured() bool {
	endpoint, err := url.Parse(h.config.Endpoint)
	return err == nil && (endpoint.Scheme == "http" || endpoint.Scheme == "https") && endpoint.Host != "" && strings.TrimSpace(h.config.Token) != ""
}

func newerVersion(latest, current string) bool {
	latestParts, latestOK := versionParts(latest)
	currentParts, currentOK := versionParts(current)
	if !latestOK {
		return false
	}
	if !currentOK {
		return current == "dev" || current == "unknown" || current == "local"
	}
	for i := range latestParts {
		if latestParts[i] != currentParts[i] {
			return latestParts[i] > currentParts[i]
		}
	}
	return false
}

func versionParts(value string) ([3]int, bool) {
	var result [3]int
	value = strings.TrimPrefix(strings.TrimSpace(value), "v")
	value = strings.SplitN(value, "-", 2)[0]
	parts := strings.Split(value, ".")
	if len(parts) != 3 {
		return result, false
	}
	for i, part := range parts {
		number, err := strconv.Atoi(part)
		if err != nil || number < 0 {
			return result, false
		}
		result[i] = number
	}
	return result, true
}
