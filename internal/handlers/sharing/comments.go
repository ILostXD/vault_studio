package sharing

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"bungleware/vault/internal/apperr"
	sqlc "bungleware/vault/internal/db/sqlc"
	"bungleware/vault/internal/handlers"
	"bungleware/vault/internal/httputil"

	"golang.org/x/crypto/bcrypt"
)

func (h *SharingHandler) ListWaveformComments(w http.ResponseWriter, r *http.Request) error {
	userID, err := httputil.RequireUserID(r)
	if err != nil {
		return apperr.NewUnauthorized("user not found in context")
	}
	version, track, err := h.commentVersion(r)
	if err != nil {
		return err
	}
	if !h.canAccessTrack(r.Context(), track, int64(userID)) {
		return apperr.NewForbidden("track access required")
	}
	return h.writeComments(w, r.Context(), version.ID)
}

func (h *SharingHandler) CreateWaveformComment(w http.ResponseWriter, r *http.Request) error {
	userID, err := httputil.RequireUserID(r)
	if err != nil {
		return apperr.NewUnauthorized("user not found in context")
	}
	version, track, err := h.commentVersion(r)
	if err != nil {
		return err
	}
	if !h.canAccessTrack(r.Context(), track, int64(userID)) {
		return apperr.NewForbidden("track access required")
	}
	user, err := h.db.GetUserByID(r.Context(), int64(userID))
	if err != nil {
		return apperr.NewInternal("failed to load comment author", err)
	}
	return h.createComment(w, r, version, sql.NullInt64{Int64: int64(userID), Valid: true}, user.Username)
}

func (h *SharingHandler) UpdateWaveformComment(w http.ResponseWriter, r *http.Request) error {
	userID, err := httputil.RequireUserID(r)
	if err != nil {
		return apperr.NewUnauthorized("user not found in context")
	}
	commentID, err := httputil.PathInt64(r, "commentId")
	if err != nil {
		return err
	}

	r.Body = http.MaxBytesReader(w, r.Body, 16*1024)
	var req handlers.UpdateWaveformCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return apperr.NewBadRequest("invalid comment")
	}
	text := strings.TrimSpace(req.Text)
	if err := validateCommentText(text); err != nil {
		return apperr.NewBadRequest(err.Error())
	}

	comment, err := h.db.UpdateWaveformComment(r.Context(), sqlc.UpdateWaveformCommentParams{
		CommentText: text,
		ID:          commentID,
		UserID:      sql.NullInt64{Int64: int64(userID), Valid: true},
	})
	if errors.Is(err, sql.ErrNoRows) {
		return apperr.NewForbidden("you can only edit your own comments")
	}
	if err != nil {
		return apperr.NewInternal("failed to update comment", err)
	}
	return httputil.OKResult(w, waveformCommentResponse(comment))
}

func (h *SharingHandler) DeleteWaveformComment(w http.ResponseWriter, r *http.Request) error {
	userID, err := httputil.RequireUserID(r)
	if err != nil {
		return apperr.NewUnauthorized("user not found in context")
	}
	commentID, err := httputil.PathInt64(r, "commentId")
	if err != nil {
		return err
	}

	deleted, err := h.db.DeleteWaveformComment(r.Context(), sqlc.DeleteWaveformCommentParams{
		ID:     commentID,
		UserID: sql.NullInt64{Int64: int64(userID), Valid: true},
	})
	if err != nil {
		return apperr.NewInternal("failed to delete comment", err)
	}
	if deleted == 0 {
		return apperr.NewForbidden("you can only delete your own comments")
	}
	return httputil.NoContentResult(w)
}

func (h *SharingHandler) ListSharedWaveformComments(w http.ResponseWriter, r *http.Request) error {
	version, track, err := h.commentVersion(r)
	if err != nil {
		return err
	}
	if err := h.validateCommentShare(r.Context(), r.PathValue("token"), r.URL.Query().Get("password"), version, track); err != nil {
		return err
	}
	return h.writeComments(w, r.Context(), version.ID)
}

func (h *SharingHandler) CreateSharedWaveformComment(w http.ResponseWriter, r *http.Request) error {
	version, track, err := h.commentVersion(r)
	if err != nil {
		return err
	}
	var req handlers.CreateWaveformCommentRequest
	r.Body = http.MaxBytesReader(w, r.Body, 16*1024)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return apperr.NewBadRequest("invalid comment")
	}
	if err := h.validateCommentShare(r.Context(), r.PathValue("token"), req.Password, version, track); err != nil {
		return err
	}
	return h.createCommentRequest(w, r.Context(), version, sql.NullInt64{}, strings.TrimSpace(req.AuthorName), req)
}

func (h *SharingHandler) createComment(w http.ResponseWriter, r *http.Request, version sqlc.TrackVersion, userID sql.NullInt64, author string) error {
	var req handlers.CreateWaveformCommentRequest
	r.Body = http.MaxBytesReader(w, r.Body, 16*1024)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return apperr.NewBadRequest("invalid comment")
	}
	return h.createCommentRequest(w, r.Context(), version, userID, author, req)
}

func (h *SharingHandler) createCommentRequest(w http.ResponseWriter, ctx context.Context, version sqlc.TrackVersion, userID sql.NullInt64, author string, req handlers.CreateWaveformCommentRequest) error {
	text := strings.TrimSpace(req.Text)
	if err := validateCommentInput(author, text, req.TimestampSeconds, version.DurationSeconds); err != nil {
		return apperr.NewBadRequest(err.Error())
	}

	comment, err := h.db.CreateWaveformComment(ctx, sqlc.CreateWaveformCommentParams{
		VersionID: version.ID, UserID: userID, AuthorName: author,
		CommentText: text, TimestampSeconds: req.TimestampSeconds,
	})
	if err != nil {
		return apperr.NewInternal("failed to create comment", err)
	}
	return httputil.CreatedResult(w, waveformCommentResponse(comment))
}

func validateCommentInput(author, text string, timestamp float64, duration sql.NullFloat64) error {
	if author == "" || len(author) > 80 {
		return fmt.Errorf("author name is required and must be 80 characters or fewer")
	}
	if err := validateCommentText(text); err != nil {
		return err
	}
	if timestamp < 0 || (duration.Valid && timestamp > duration.Float64+0.5) {
		return fmt.Errorf("comment timestamp is outside the track")
	}
	return nil
}

func validateCommentText(text string) error {
	if text == "" || len(text) > 2000 {
		return fmt.Errorf("comment must be between 1 and 2000 characters")
	}
	return nil
}

func (h *SharingHandler) writeComments(w http.ResponseWriter, ctx context.Context, versionID int64) error {
	comments, err := h.db.ListWaveformCommentsByVersion(ctx, versionID)
	if err != nil {
		return apperr.NewInternal("failed to list comments", err)
	}
	result := make([]handlers.WaveformCommentResponse, len(comments))
	for i, comment := range comments {
		result[i] = waveformCommentResponse(comment)
	}
	return httputil.OKResult(w, result)
}

func waveformCommentResponse(comment sqlc.WaveformComment) handlers.WaveformCommentResponse {
	var userID *int64
	if comment.UserID.Valid {
		userID = &comment.UserID.Int64
	}
	return handlers.WaveformCommentResponse{
		ID: comment.ID, VersionID: comment.VersionID, UserID: userID,
		AuthorName: comment.AuthorName, Text: comment.CommentText,
		TimestampSeconds: comment.TimestampSeconds, CreatedAt: comment.CreatedAt.Format(time.RFC3339),
	}
}

func (h *SharingHandler) commentVersion(r *http.Request) (sqlc.TrackVersion, sqlc.Track, error) {
	versionID, err := httputil.PathInt64(r, "versionId")
	if err != nil {
		return sqlc.TrackVersion{}, sqlc.Track{}, err
	}
	version, err := h.db.GetTrackVersion(r.Context(), versionID)
	if err := httputil.HandleDBError(err, "version not found", "failed to load version"); err != nil {
		return sqlc.TrackVersion{}, sqlc.Track{}, err
	}
	track, err := h.db.GetTrackByID(r.Context(), version.TrackID)
	if err := httputil.HandleDBError(err, "track not found", "failed to load track"); err != nil {
		return sqlc.TrackVersion{}, sqlc.Track{}, err
	}
	return version, track, nil
}

func (h *SharingHandler) canAccessTrack(ctx context.Context, track sqlc.Track, userID int64) bool {
	if track.UserID == userID {
		return true
	}
	project, err := h.db.GetProjectByID(ctx, track.ProjectID)
	if err == nil && project.UserID == userID {
		return true
	}
	if _, err := h.db.GetUserTrackShare(ctx, sqlc.GetUserTrackShareParams{TrackID: track.ID, SharedTo: userID}); err == nil {
		return true
	}
	_, err = h.db.GetUserProjectShare(ctx, sqlc.GetUserProjectShareParams{ProjectID: track.ProjectID, SharedTo: userID})
	return err == nil
}

func (h *SharingHandler) validateCommentShare(ctx context.Context, token, password string, version sqlc.TrackVersion, track sqlc.Track) error {
	trackShare, err := h.db.GetShareToken(ctx, token)
	if err == nil {
		if err := validShare(trackShare.ExpiresAt, trackShare.MaxAccessCount, trackShare.CurrentAccessCount, trackShare.PasswordHash, password); err != nil {
			return err
		}
		if trackShare.TrackID != track.ID || (trackShare.VersionID.Valid && trackShare.VersionID.Int64 != version.ID) || (!trackShare.VersionID.Valid && (!track.ActiveVersionID.Valid || track.ActiveVersionID.Int64 != version.ID)) {
			return apperr.NewForbidden("version is not shared")
		}
		return nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return apperr.NewInternal("failed to validate share", err)
	}

	projectShare, err := h.db.GetProjectShareToken(ctx, token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return apperr.NewUnauthorized("invalid share token")
		}
		return apperr.NewInternal("failed to validate share", err)
	}
	if err := validShare(projectShare.ExpiresAt, projectShare.MaxAccessCount, projectShare.CurrentAccessCount, projectShare.PasswordHash, password); err != nil {
		return err
	}
	if projectShare.ProjectID != track.ProjectID || !track.ActiveVersionID.Valid || track.ActiveVersionID.Int64 != version.ID {
		return apperr.NewForbidden("version is not shared")
	}
	return nil
}

func validShare(expires sql.NullTime, maximum, current sql.NullInt64, passwordHash sql.NullString, password string) error {
	if expires.Valid && expires.Time.Before(time.Now()) {
		return apperr.NewForbidden("share token expired")
	}
	if maximum.Valid && current.Int64 >= maximum.Int64 {
		return apperr.NewForbidden("share access limit reached")
	}
	if passwordHash.Valid && bcrypt.CompareHashAndPassword([]byte(passwordHash.String), []byte(password)) != nil {
		return apperr.NewUnauthorized("share password required")
	}
	return nil
}
