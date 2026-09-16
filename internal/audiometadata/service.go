// Package audiometadata resolves project-scoped file tags independently of delivery destinations.
package audiometadata

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"

	appdb "bungleware/vault/internal/db"
	db "bungleware/vault/internal/db/sqlc"
	"bungleware/vault/internal/distribution"
)

var (
	ErrInvalid     = errors.New("invalid audio metadata")
	ErrUnavailable = errors.New("source audio or artwork is unavailable")
	ErrUnsupported = errors.New("tagged download is not supported for this format")
	ErrBusy        = errors.New("another tagged download is being prepared; please try again shortly")
)

type Fields struct {
	Album       string `json:"album"`
	Artist      string `json:"artist"`
	AlbumArtist string `json:"album_artist"`
	Genre       string `json:"genre"`
	Year        string `json:"year"`
}

type Track struct {
	Fields
	TrackID        int64  `json:"track_id"`
	PublicID       string `json:"public_id"`
	ArtistOverride string `json:"artist_override"`
	AlbumOverride  string `json:"album_override"`
	VersionID      int64  `json:"version_id"`
	VersionName    string `json:"version_name"`
	Title          string `json:"title"`
	Number         int    `json:"track_number"`
	Artwork        bool   `json:"artwork"`
	Format         string `json:"format"`
	SourceFormat   string `json:"source_format"`
	Conversion     string `json:"conversion,omitempty"`
	CanDownload    bool   `json:"can_download"`
	Reason         string `json:"reason,omitempty"`
	sourcePath     string
	coverPath      string
}

type State struct {
	Metadata Fields  `json:"metadata"`
	Artwork  bool    `json:"artwork"`
	Tracks   []Track `json:"tracks"`
}

type Service struct {
	db      *appdb.DB
	root    string
	exports chan struct{}
}

func NewService(database *appdb.DB, root string) *Service {
	return &Service{db: database, root: root, exports: make(chan struct{}, 2)}
}

func (s *Service) Resolve(ctx context.Context, userID, projectID int64) (State, error) {
	state := State{Tracks: []Track{}}
	project, err := s.db.GetProject(ctx, db.GetProjectParams{ID: projectID, UserID: userID})
	if err != nil {
		return state, err
	}
	// Only explicitly entered, project-scoped preparation values are eligible defaults.
	// Do not resolve distribution's global artist profile or estimated release date here.
	var preparation distribution.Preparation
	row, err := s.db.GetDistributionPreparation(ctx, db.GetDistributionPreparationParams{ProjectID: projectID, UserID: userID})
	if err == nil {
		err = json.Unmarshal([]byte(row.PreparationJson), &preparation)
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return state, err
	}
	fields := Fields{Album: project.Name, Artist: project.AuthorOverride.String}
	saved, err := s.db.GetProjectAudioMetadata(ctx, projectID)
	if err == nil {
		fields.AlbumArtist, fields.Genre, fields.Year = saved.AlbumArtist, saved.Genre, saved.Year
	} else if errors.Is(err, sql.ErrNoRows) {
		if fields.Artist == "" && preparation.Release.Artist != nil {
			fields.Artist = *preparation.Release.Artist
		}
		if preparation.Release.Genres != nil {
			fields.Genre = strings.Join(*preparation.Release.Genres, "; ")
		}
		if date := preparation.Release.ReleaseDate; date != nil && len(*date) >= 4 && validYear((*date)[:4]) {
			fields.Year = (*date)[:4]
		}
	} else {
		return state, err
	}
	state.Metadata = fields
	state.Artwork = project.CoverArtPath.Valid && project.CoverArtPath.String != ""
	tracks, err := s.db.ListAudioMetadataTracks(ctx, projectID)
	if err != nil {
		return state, err
	}
	for i, row := range tracks {
		resolved := fields
		if resolved.AlbumArtist == "" {
			resolved.AlbumArtist = fields.Artist
		}
		if strings.TrimSpace(row.Artist.String) != "" {
			resolved.Artist = row.Artist.String
		}
		if strings.TrimSpace(row.Album.String) != "" {
			resolved.Album = row.Album.String
		}
		t := Track{Fields: resolved, TrackID: row.ID, VersionID: row.ActiveVersionID.Int64,
			PublicID: row.PublicID, ArtistOverride: row.Artist.String, AlbumOverride: row.Album.String,
			VersionName: row.VersionName.String, Title: row.Title, Number: i + 1, Artwork: state.Artwork,
			Format: strings.ToLower(row.Format.String), sourcePath: row.FilePath.String, coverPath: project.CoverArtPath.String}
		t.SourceFormat = t.Format
		if !supported(t.SourceFormat) && row.FileID.Valid {
			t.Format, t.Conversion, err = s.conversionPlan(ctx, t.SourceFormat, t.sourcePath)
			if err != nil {
				t.Reason = "The source could not be inspected for safe conversion."
			}
		} else if t.Format == "alac" {
			t.Format = "m4a"
		}
		if !row.FileID.Valid {
			t.Reason = "The current version has no completed source file."
		} else if t.Reason == "" {
			t.CanDownload = true
		}
		state.Tracks = append(state.Tracks, t)
	}
	return state, nil
}

func (s *Service) Save(ctx context.Context, userID, projectID int64, fields Fields) error {
	fields.Album = strings.TrimSpace(fields.Album)
	fields.Artist = strings.TrimSpace(fields.Artist)
	fields.AlbumArtist = strings.TrimSpace(fields.AlbumArtist)
	fields.Genre = strings.TrimSpace(fields.Genre)
	fields.Year = strings.TrimSpace(fields.Year)
	if fields.Album == "" || !validYear(fields.Year) {
		return fmt.Errorf("%w: album is required; year must be blank or four digits (0001-9999)", ErrInvalid)
	}
	for _, value := range []string{fields.Album, fields.Artist, fields.AlbumArtist, fields.Genre} {
		if !validText(value) {
			return fmt.Errorf("%w: text must be at most 512 characters without control characters", ErrInvalid)
		}
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	q := s.db.Queries.WithTx(tx)
	n, err := q.UpdateProjectAudioIdentity(ctx, db.UpdateProjectAudioIdentityParams{
		ID: projectID, UserID: userID, Name: fields.Album, AuthorOverride: sql.NullString{String: fields.Artist, Valid: fields.Artist != ""},
	})
	if err != nil {
		return err
	}
	if n != 1 {
		return sql.ErrNoRows
	}
	err = q.SaveProjectAudioMetadata(ctx, db.SaveProjectAudioMetadataParams{ProjectID: projectID, AlbumArtist: fields.AlbumArtist, Genre: fields.Genre, Year: fields.Year})
	if err != nil {
		return err
	}
	return tx.Commit()
}

func validText(value string) bool {
	return utf8.ValidString(value) && utf8.RuneCountInString(value) <= 512 && strings.IndexFunc(value, unicode.IsControl) < 0
}

func validYear(year string) bool {
	if year == "" {
		return true
	}
	return len(year) == 4 && year != "0000" && strings.IndexFunc(year, func(r rune) bool { return r < '0' || r > '9' }) < 0
}

func supported(format string) bool {
	switch format {
	case "wav", "aif", "aiff", "flac", "mp3", "m4a", "alac", "ogg", "opus", "wma":
		return true
	default:
		return false
	}
}
