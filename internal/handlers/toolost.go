package handlers

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"bungleware/vault/internal/apperr"
	sqlc "bungleware/vault/internal/db/sqlc"
	"bungleware/vault/internal/distribution"
	"bungleware/vault/internal/distribution/toolost"
	"bungleware/vault/internal/httputil"
	"bungleware/vault/internal/integrations"
	"bungleware/vault/internal/middleware"
)

type TooLostConfig struct {
	ClientID, ClientSecret, PublicBaseURL, Environment, TokenEncryptionKey string
	SignedURLSecret                                                        string
	SignedURLExpiration                                                    time.Duration
}

type TooLostHandler struct {
	queries      *sqlc.Queries
	distribution *distribution.Service
	secrets      *integrations.SecretBox
	runtimeMu    sync.RWMutex
	config       TooLostConfig
	client       *toolost.Client
}

type storedTooLostConfiguration struct {
	ClientID      string `json:"client_id"`
	ClientSecret  string `json:"client_secret"`
	PublicBaseURL string `json:"public_base_url"`
	Environment   string `json:"environment"`
}

type tooLostConfigurationRequest struct {
	ClientID      string `json:"client_id"`
	ClientSecret  string `json:"client_secret"`
	PublicBaseURL string `json:"public_base_url"`
	Environment   string `json:"environment"`
}

func NewTooLostHandler(queries *sqlc.Queries, service *distribution.Service, config TooLostConfig) *TooLostHandler {
	secretBox, secretErr := integrations.NewSecretBox(config.TokenEncryptionKey)
	if secretErr != nil {
		slog.Warn("provider credential encryption is unavailable", "error", secretErr)
	}
	handler := &TooLostHandler{queries: queries, distribution: service, secrets: secretBox}
	handler.applyConfig(config)
	if secretBox == nil {
		return handler
	}

	row, err := queries.GetProviderSetting(context.Background(), "toolost")
	if errors.Is(err, sql.ErrNoRows) {
		return handler
	}
	if err != nil {
		slog.Warn("could not load Too Lost settings", "error", err)
		return handler
	}
	plain, err := secretBox.Open(row.EncryptedConfig, "provider-settings:toolost")
	if err != nil {
		slog.Warn("could not decrypt Too Lost settings", "error", err)
		return handler
	}
	var stored storedTooLostConfiguration
	if err := json.Unmarshal(plain, &stored); err != nil {
		slog.Warn("could not decode Too Lost settings", "error", err)
		return handler
	}
	config.ClientID = stored.ClientID
	config.ClientSecret = stored.ClientSecret
	config.PublicBaseURL = stored.PublicBaseURL
	config.Environment = stored.Environment
	handler.applyConfig(config)
	return handler
}

func (h *TooLostHandler) applyConfig(config TooLostConfig) {
	environment := strings.ToLower(strings.TrimSpace(config.Environment))
	if environment != "production" {
		environment = "sandbox"
	}
	config.Environment = environment
	apiBase := toolost.SandboxAPI
	if environment == "production" {
		apiBase = toolost.ProductionAPI
	}
	redirect := strings.TrimRight(config.PublicBaseURL, "/") + "/api/integrations/toolost/callback"
	h.runtimeMu.Lock()
	h.config = config
	h.client = &toolost.Client{APIBase: apiBase, TokenEndpoint: toolost.TokenURL, ClientID: config.ClientID, ClientSecret: config.ClientSecret, RedirectURI: redirect}
	h.runtimeMu.Unlock()
}

func (h *TooLostHandler) runtime() (TooLostConfig, *toolost.Client) {
	h.runtimeMu.RLock()
	defer h.runtimeMu.RUnlock()
	return h.config, h.client
}

func (h *TooLostHandler) configured(config TooLostConfig) bool {
	base, err := url.Parse(config.PublicBaseURL)
	return h.secrets != nil && strings.TrimSpace(config.ClientID) != "" && strings.TrimSpace(config.ClientSecret) != "" && err == nil && base.Scheme == "https" && base.Host != ""
}

func (h *TooLostHandler) GetConfiguration(w http.ResponseWriter, r *http.Request) error {
	if err := h.requireAdmin(r); err != nil {
		return err
	}
	config, _ := h.runtime()
	return httputil.OKResult(w, h.configurationResponse(config))
}

func (h *TooLostHandler) SaveConfiguration(w http.ResponseWriter, r *http.Request) error {
	if err := h.requireAdmin(r); err != nil {
		return err
	}
	request, err := httputil.DecodeJSON[tooLostConfigurationRequest](r)
	if err != nil {
		return apperr.NewBadRequest("invalid request body")
	}

	current, _ := h.runtime()
	request.ClientID = strings.TrimSpace(request.ClientID)
	request.ClientSecret = strings.TrimSpace(request.ClientSecret)
	request.PublicBaseURL = strings.TrimRight(strings.TrimSpace(request.PublicBaseURL), "/")
	request.Environment = strings.ToLower(strings.TrimSpace(request.Environment))
	if request.Environment == "" {
		request.Environment = "sandbox"
	}
	if request.ClientSecret == "" {
		request.ClientSecret = current.ClientSecret
	}
	if request.ClientID == "" {
		return apperr.NewBadRequest("Too Lost client ID is required")
	}
	if request.ClientSecret == "" {
		return apperr.NewBadRequest("Too Lost client secret is required")
	}
	if request.Environment != "sandbox" && request.Environment != "production" {
		return apperr.NewBadRequest("Too Lost environment must be sandbox or production")
	}
	if err := validatePublicBaseURL(request.PublicBaseURL); err != nil {
		return apperr.NewBadRequest(err.Error())
	}
	if h.secrets == nil {
		return apperr.NewInternal("provider credential encryption is unavailable", errors.New("invalid provider token encryption key"))
	}

	stored := storedTooLostConfiguration(request)
	plain, err := json.Marshal(stored)
	if err != nil {
		return apperr.NewInternal("failed to encode Too Lost settings", err)
	}
	encrypted, err := h.secrets.Seal(plain, "provider-settings:toolost")
	if err != nil {
		return apperr.NewInternal("failed to encrypt Too Lost settings", err)
	}
	if err := h.queries.SaveProviderSetting(r.Context(), sqlc.SaveProviderSettingParams{Provider: "toolost", EncryptedConfig: encrypted}); err != nil {
		return apperr.NewInternal("failed to save Too Lost settings", err)
	}

	current.ClientID = stored.ClientID
	current.ClientSecret = stored.ClientSecret
	current.PublicBaseURL = stored.PublicBaseURL
	current.Environment = stored.Environment
	h.applyConfig(current)
	return httputil.OKResult(w, h.configurationResponse(current))
}

func (h *TooLostHandler) configurationResponse(config TooLostConfig) map[string]any {
	callbackURL := ""
	if config.PublicBaseURL != "" {
		callbackURL = strings.TrimRight(config.PublicBaseURL, "/") + "/api/integrations/toolost/callback"
	}
	return map[string]any{
		"client_id":                config.ClientID,
		"client_secret_configured": strings.TrimSpace(config.ClientSecret) != "",
		"public_base_url":          config.PublicBaseURL,
		"environment":              config.Environment,
		"callback_url":             callbackURL,
		"configured":               h.configured(config),
		"encryption_managed":       h.secrets != nil,
	}
}

func (h *TooLostHandler) requireAdmin(r *http.Request) error {
	userID, err := httputil.RequireUserID(r)
	if err != nil {
		return apperr.NewUnauthorized("unauthorized")
	}
	user, err := h.queries.GetUserByID(r.Context(), int64(userID))
	if err != nil {
		return apperr.NewUnauthorized("unauthorized")
	}
	if !user.IsAdmin {
		return apperr.NewForbidden("admin access required")
	}
	return nil
}

func validatePublicBaseURL(value string) error {
	base, err := url.Parse(value)
	if err != nil || base.Scheme != "https" || base.Host == "" {
		return errors.New("public Vault URL must be a valid HTTPS address")
	}
	if base.User != nil || base.RawQuery != "" || base.Fragment != "" {
		return errors.New("public Vault URL cannot contain credentials, a query, or a fragment")
	}
	return nil
}

func (h *TooLostHandler) Status(w http.ResponseWriter, r *http.Request) error {
	userID, err := distributionUserID(r)
	if err != nil {
		return err
	}
	config, _ := h.runtime()
	isConfigured := h.configured(config)
	connected := false
	if isConfigured {
		_, err = h.queries.GetProviderConnection(r.Context(), providerConnectionParams(userID, config.Environment))
		connected = err == nil
	}
	callbackURL := ""
	if strings.TrimSpace(config.PublicBaseURL) != "" {
		callbackURL = strings.TrimRight(config.PublicBaseURL, "/") + "/api/integrations/toolost/callback"
	}
	return httputil.OKResult(w, map[string]any{"configured": isConfigured, "connected": connected, "environment": config.Environment, "callback_url": callbackURL, "artwork_transfer": "cover_url", "final_submission": "in_toolost"})
}

func (h *TooLostHandler) Lookups(w http.ResponseWriter, r *http.Request) error {
	userID, err := distributionUserID(r)
	if err != nil {
		return err
	}
	config, client := h.runtime()
	if !h.configured(config) {
		return distributionUnavailable("Too Lost is not configured for this instance")
	}
	token, err := h.token(r.Context(), userID, config.Environment)
	if errors.Is(err, sql.ErrNoRows) {
		return distributionUnavailable("Connect Too Lost to load its metadata catalog")
	}
	if err != nil {
		return err
	}
	genres, err := client.ListGenres(r.Context(), token.AccessToken)
	if err != nil {
		return tooLostProviderError(err)
	}
	languages, err := client.ListLanguages(r.Context(), token.AccessToken)
	if err != nil {
		return tooLostProviderError(err)
	}
	return httputil.OKResult(w, map[string]any{"genres": genres, "languages": languages})
}

func (h *TooLostHandler) Connect(w http.ResponseWriter, r *http.Request) error {
	userID, err := distributionUserID(r)
	if err != nil {
		return err
	}
	config, client := h.runtime()
	if !h.configured(config) {
		return httputil.OKResult(w, map[string]any{"configured": false, "message": "Ask the instance administrator to configure Too Lost OAuth and a public HTTPS URL."})
	}
	state, err := randomURLToken(32)
	if err != nil {
		return err
	}
	verifier, err := randomURLToken(48)
	if err != nil {
		return err
	}
	challengeBytes := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(challengeBytes[:])
	encryptedVerifier, err := h.secrets.Seal([]byte(verifier), providerOwner(userID, config.Environment))
	if err != nil {
		return err
	}
	_ = h.queries.ExpireProviderOAuthStates(r.Context(), time.Now().Unix())
	err = h.queries.SaveProviderOAuthState(r.Context(), sqlc.SaveProviderOAuthStateParams{StateHash: hashState(state), UserID: userID, Provider: "toolost", Environment: config.Environment, EncryptedVerifier: encryptedVerifier, ExpiresAt: time.Now().Add(10 * time.Minute).Unix()})
	if err != nil {
		return err
	}
	authorizationURL, err := client.AuthorizationURL(state, challenge, []string{"read:profile", "read:releases", "read:preferences", "write:releases"})
	if err != nil {
		return err
	}
	return httputil.OKResult(w, map[string]any{"configured": true, "url": authorizationURL})
}

func (h *TooLostHandler) Callback(w http.ResponseWriter, r *http.Request) error {
	config, client := h.runtime()
	if !h.configured(config) {
		http.Error(w, "Too Lost integration is not configured", http.StatusServiceUnavailable)
		return nil
	}
	if providerError := r.URL.Query().Get("error"); providerError != "" {
		return h.callbackRedirect(w, r, "error", providerError)
	}
	state, code := r.URL.Query().Get("state"), r.URL.Query().Get("code")
	if state == "" || code == "" {
		http.Error(w, "Missing OAuth state or code", http.StatusBadRequest)
		return nil
	}
	stored, err := h.queries.ConsumeProviderOAuthState(r.Context(), sqlc.ConsumeProviderOAuthStateParams{StateHash: hashState(state), ExpiresAt: time.Now().Unix()})
	if errors.Is(err, sql.ErrNoRows) {
		http.Error(w, "OAuth request expired or already used", http.StatusBadRequest)
		return nil
	}
	if err != nil {
		return err
	}
	verifier, err := h.secrets.Open(stored.EncryptedVerifier, providerOwner(stored.UserID, stored.Environment))
	if err != nil {
		return err
	}
	token, err := client.ExchangeCode(r.Context(), code, string(verifier))
	if err != nil {
		return h.callbackRedirect(w, r, "error", "token_exchange_failed")
	}
	plain, err := json.Marshal(token)
	if err != nil {
		return err
	}
	encrypted, err := h.secrets.Seal(plain, providerOwner(stored.UserID, stored.Environment))
	if err != nil {
		return err
	}
	err = h.queries.SaveProviderConnection(r.Context(), sqlc.SaveProviderConnectionParams{UserID: stored.UserID, Provider: "toolost", Environment: stored.Environment, EncryptedToken: encrypted})
	if err != nil {
		return err
	}
	return h.callbackRedirect(w, r, "connected", "")
}

func (h *TooLostHandler) callbackRedirect(w http.ResponseWriter, r *http.Request, status, message string) error {
	target := "/profile?toolost=" + url.QueryEscape(status)
	if message != "" {
		target += "&message=" + url.QueryEscape(message)
	}
	http.Redirect(w, r, target, http.StatusSeeOther)
	return nil
}

func (h *TooLostHandler) Disconnect(w http.ResponseWriter, r *http.Request) error {
	userID, err := distributionUserID(r)
	if err != nil {
		return err
	}
	config, _ := h.runtime()
	if err = h.queries.DeleteProviderConnection(r.Context(), sqlc.DeleteProviderConnectionParams{UserID: userID, Provider: "toolost", Environment: config.Environment}); err != nil {
		return err
	}
	_ = h.queries.DeleteProviderOAuthStates(r.Context(), sqlc.DeleteProviderOAuthStatesParams{UserID: userID, Provider: "toolost", Environment: config.Environment})
	return httputil.NoContentResult(w)
}

func (h *TooLostHandler) CreateDraft(w http.ResponseWriter, r *http.Request) error {
	userID, projectID, err := distributionIDs(r)
	if err != nil {
		return err
	}
	config, client := h.runtime()
	if !h.configured(config) {
		return distributionUnavailable("Too Lost is not configured for this instance")
	}
	token, err := h.token(r.Context(), userID, config.Environment)
	if errors.Is(err, sql.ErrNoRows) {
		return distributionUnavailable("Connect Too Lost before creating a draft")
	}
	if err != nil {
		return err
	}
	release, validation, err := h.distribution.Snapshot(r.Context(), userID, projectID)
	if err != nil {
		return distributionError("prepare Too Lost draft", err)
	}
	validation = validateTooLost(release, validation)
	if !validation.CanSend {
		httputil.WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{"error": "Release needs attention before it can be sent", "release": release, "validation": validation})
		return nil
	}
	history, err := h.distribution.RecordSnapshot(r.Context(), userID, projectID, distribution.SnapshotInput{Snapshot: release, Kind: "send", Provider: "toolost", Environment: config.Environment})
	if err != nil {
		return err
	}
	fail := func(cause error) error {
		status := "failed"
		message := cause.Error()
		_, _ = h.distribution.UpdateHistory(context.Background(), userID, projectID, history.ID, distribution.HistoryUpdate{Status: &status, Message: &message})
		return tooLostProviderError(cause)
	}
	draftID, created := "", false
	previous, historyErr := h.distribution.History(r.Context(), userID, projectID)
	if historyErr != nil {
		return fail(historyErr)
	}
	for _, entry := range previous {
		if entry.ID != history.ID && entry.Provider == "toolost" && entry.Environment == config.Environment && entry.Status == "succeeded" && strings.EqualFold(entry.ProviderStatus, "draft") && entry.RemoteID != "" {
			draftID = entry.RemoteID
			break
		}
	}
	if draftID != "" {
		remote, lookupErr := client.GetRelease(r.Context(), token.AccessToken, draftID)
		var apiErr *toolost.APIError
		if errors.As(lookupErr, &apiErr) && apiErr.Status == http.StatusNotFound {
			draftID = ""
		} else if lookupErr != nil {
			return fail(lookupErr)
		} else if !strings.EqualFold(remote.Status, "draft") {
			draftID = ""
		}
	}
	if draftID == "" {
		draft, createErr := client.CreateDraft(r.Context(), token.AccessToken, toolost.CreateDraftRequest{Type: canonicalReleaseType(release.ReleaseType), Title: release.Title, Participants: []toolost.Participant{{Name: release.Artist, Roles: []string{"primary"}}}, Label: release.Label})
		if createErr != nil {
			return fail(createErr)
		}
		if draft.ID == "" {
			return fail(errors.New("Too Lost created a draft without returning its ID"))
		}
		draftID, created = draft.ID, true
	}
	history, err = h.distribution.UpdateHistory(r.Context(), userID, projectID, history.ID, distribution.HistoryUpdate{RemoteID: &draftID})
	if err != nil {
		return err
	}
	tracks := make([]toolost.Track, 0, len(release.Tracks))
	for _, source := range release.Tracks {
		flacPath, cleanup, prepErr := h.distribution.PrepareFLAC(r.Context(), *source.Master)
		if prepErr != nil {
			return fail(prepErr)
		}
		info, statErr := os.Stat(flacPath)
		if statErr != nil {
			cleanup()
			return fail(statErr)
		}
		filename := fmt.Sprintf("%02d-%s.flac", source.Number, strings.ReplaceAll(strings.ToLower(source.Title), " ", "-"))
		target, uploadErr := client.RequestUploadURL(r.Context(), token.AccessToken, draftID, toolost.UploadURLRequest{Kind: "stereo", Filename: filename, ContentType: "audio/flac"})
		if uploadErr != nil {
			cleanup()
			return fail(uploadErr)
		}
		file, openErr := os.Open(flacPath)
		if openErr != nil {
			cleanup()
			return fail(openErr)
		}
		uploadErr = client.Upload(r.Context(), target, file, info.Size())
		_ = file.Close()
		cleanup()
		if uploadErr != nil {
			return fail(uploadErr)
		}
		writers := tooLostWriters(source.Credits)
		track := toolost.Track{Title: source.Title, Language: source.Language, AudioFileKey: target.FileKey, Artists: []toolost.Participant{{Name: source.Artist, Roles: []string{"primary"}}}, Writers: writers, Explicit: source.Explicit, ISRC: source.ISRC}
		if strings.TrimSpace(source.Lyrics) != "" {
			explicit := false
			if source.Explicit != nil {
				explicit = *source.Explicit
			}
			track.Lyrics = &toolost.Lyrics{Content: source.Lyrics, Explicit: explicit}
		}
		tracks = append(tracks, track)
	}
	if err = client.ReplaceTracks(r.Context(), token.AccessToken, draftID, tracks); err != nil {
		return fail(err)
	}
	metadata := toolost.MetadataRequest{Title: release.Title, Label: release.Label, Language: release.Language, ReleaseDate: release.ReleaseDate, OriginalReleaseDate: release.OriginalReleaseDate, UPC: release.UPC, CLine: release.Copyright, PLine: release.PhonographicCopyright}
	if len(release.Genres) > 0 {
		metadata.PrimaryGenre = release.Genres[0]
	}
	if len(release.Genres) > 1 {
		metadata.SecondaryGenre = release.Genres[1]
	}
	if release.Artwork != nil {
		metadata.CoverURL, err = h.coverURL(r.Context(), userID, projectID, config)
		if err != nil {
			return fail(err)
		}
	}
	if err = client.PatchMetadata(r.Context(), token.AccessToken, draftID, metadata); err != nil {
		return fail(err)
	}
	action := "updated"
	if created {
		action = "created"
	}
	status, providerStatus, message := "succeeded", "draft", "Draft "+action+". Complete motion artwork, delivery settings, rights confirmation, review, and final submission in Too Lost."
	history, err = h.distribution.UpdateHistory(r.Context(), userID, projectID, history.ID, distribution.HistoryUpdate{Status: &status, ProviderStatus: &providerStatus, Message: &message})
	if err != nil {
		return err
	}
	return httputil.OKResult(w, map[string]any{"history": history, "validation": validation})
}

func (h *TooLostHandler) coverURL(ctx context.Context, userID, projectID int64, config TooLostConfig) (string, error) {
	project, err := h.queries.GetProjectByID(ctx, projectID)
	if err != nil {
		return "", err
	}
	if project.UserID != userID {
		return "", distribution.ErrNotFound
	}
	query := url.Values{}
	query.Set("user_id", strconv.FormatInt(userID, 10))
	path := "/api/projects/" + project.PublicID + "/cover"
	return middleware.BuildSignedURL(strings.TrimRight(config.PublicBaseURL, "/"), path, query, config.SignedURLSecret, config.SignedURLExpiration)
}

func (h *TooLostHandler) RefreshStatus(w http.ResponseWriter, r *http.Request) error {
	userID, projectID, err := distributionIDs(r)
	if err != nil {
		return err
	}
	historyID, err := strconv.ParseInt(r.PathValue("historyId"), 10, 64)
	if err != nil {
		return distributionUnavailable("invalid history id")
	}
	history, err := h.distribution.GetHistory(r.Context(), userID, projectID, historyID)
	if err != nil {
		return distributionError("load distribution history", err)
	}
	if history.Provider != "toolost" || history.RemoteID == "" {
		return distributionUnavailable("history entry has no Too Lost draft")
	}
	config, client := h.runtime()
	token, err := h.token(r.Context(), userID, config.Environment)
	if err != nil {
		return distributionUnavailable("Reconnect Too Lost to refresh this status")
	}
	remote, err := client.GetRelease(r.Context(), token.AccessToken, history.RemoteID)
	if err != nil {
		return tooLostProviderError(err)
	}
	history, err = h.distribution.UpdateRemoteStatus(r.Context(), userID, projectID, historyID, remote.Status, "")
	if err != nil {
		return err
	}
	return httputil.OKResult(w, history)
}

func (h *TooLostHandler) token(ctx context.Context, userID int64, environment string) (toolost.Token, error) {
	row, err := h.queries.GetProviderConnection(ctx, providerConnectionParams(userID, environment))
	if err != nil {
		return toolost.Token{}, err
	}
	plain, err := h.secrets.Open(row.EncryptedToken, providerOwner(userID, environment))
	if err != nil {
		return toolost.Token{}, err
	}
	var token toolost.Token
	err = json.Unmarshal(plain, &token)
	return token, err
}
func providerConnectionParams(userID int64, environment string) sqlc.GetProviderConnectionParams {
	return sqlc.GetProviderConnectionParams{UserID: userID, Provider: "toolost", Environment: environment}
}
func providerOwner(userID int64, environment string) string {
	return fmt.Sprintf("user:%d:toolost:%s", userID, environment)
}
func randomURLToken(n int) (string, error) {
	value := make([]byte, n)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}
func hashState(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}
func distributionUnavailable(message string) error { return apperr.NewBadRequest(message) }

func tooLostProviderError(err error) error {
	var apiErr *toolost.APIError
	if !errors.As(err, &apiErr) {
		return apperr.New(http.StatusBadGateway, err, "Too Lost could not be reached")
	}
	switch apiErr.Status {
	case http.StatusUnauthorized, http.StatusForbidden:
		return apperr.New(http.StatusConflict, err, "Too Lost connection expired; reconnect the account")
	case http.StatusTooManyRequests:
		return apperr.New(http.StatusTooManyRequests, err, "Too Lost rate limit reached; try again later")
	default:
		return apperr.New(http.StatusBadGateway, err, "Too Lost rejected the draft request")
	}
}

func validateTooLost(release distribution.Release, validation distribution.Validation) distribution.Validation {
	add := func(severity, code, field, message, remediation string, trackID int64) {
		validation.Issues = append(validation.Issues, distribution.Issue{Severity: severity, Scope: "provider", Code: code, Field: field, Message: message, Remediation: remediation, TrackID: trackID})
	}
	if canonicalReleaseType(release.ReleaseType) == "" {
		add("error", "toolost.release_type", "release.release_type", "Choose Single, EP, Album, or Compilation for Too Lost.", "fix_in_vault", 0)
	}
	for _, track := range release.Tracks {
		if track.Language == "" {
			add("error", "toolost.track_language", "tracks.language", "Too Lost requires a language for every track.", "fix_in_vault", track.TrackID)
		}
		if len(tooLostWriters(track.Credits)) == 0 {
			add("error", "toolost.writer", "tracks.credits", "Too Lost requires a composer or lyricist credit for every track.", "fix_in_vault", track.TrackID)
		}
		if track.DurationSeconds <= 0 {
			add("error", "toolost.duration_missing", "tracks.master", "Too Lost requires a known audio duration for every track.", "fix_in_vault", track.TrackID)
		} else if track.DurationSeconds < 5 {
			add("error", "toolost.duration", "tracks.master", "Too Lost requires audio at least five seconds long.", "fix_in_vault", track.TrackID)
		}
	}
	if len(release.MotionArtwork) > 0 {
		add("warning", "toolost.motion_artwork_manual", "release.motion_artwork", "Add Apple motion artwork while reviewing the draft in Too Lost.", "complete_in_provider", 0)
	}
	add("warning", "toolost.delivery_manual", "delivery", "Choose stores, territories, licensing options, and submit the release in Too Lost.", "complete_in_provider", 0)
	validation.CanSend = validation.CanExport
	for _, issue := range validation.Issues {
		if issue.Severity == "error" {
			validation.CanSend = false
			break
		}
	}
	return validation
}
func canonicalReleaseType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "single":
		return "Single"
	case "ep":
		return "EP"
	case "album":
		return "Album"
	case "compilation":
		return "Compilation"
	}
	return ""
}
func tooLostWriters(credits []distribution.Credit) []toolost.Writer {
	out := []toolost.Writer{}
	for _, credit := range credits {
		role := ""
		switch strings.ToLower(strings.TrimSpace(credit.Role)) {
		case "composer":
			role = "instrumentalist"
		case "lyricist":
			role = "lyricist"
		}
		if role != "" && strings.TrimSpace(credit.Name) != "" {
			out = append(out, toolost.Writer{Name: credit.Name, Roles: []string{role}})
		}
	}
	return out
}
