package distribution

import (
	"errors"
	"os"
	"time"
)

var (
	ErrNotFound = errors.New("release project not found")
	ErrInvalid  = errors.New("invalid release preparation")
	ErrAssets   = errors.New("release assets unavailable")
)

type Credit struct {
	Name string `json:"name"`
	Role string `json:"role"`
}

type ArtistProfile struct {
	DisplayName    string   `json:"display_name"`
	LegalName      string   `json:"legal_name"`
	DefaultCredits []Credit `json:"default_credits"`
}

// Nil overrides inherit live values; a non-nil empty value explicitly clears them.
type ReleaseOverride struct {
	Title                 *string   `json:"title,omitempty"`
	Artist                *string   `json:"artist,omitempty"`
	ReleaseType           *string   `json:"release_type,omitempty"`
	ReleaseDate           *string   `json:"release_date,omitempty"`
	OriginalReleaseDate   *string   `json:"original_release_date,omitempty"`
	Language              *string   `json:"language,omitempty"`
	Genres                *[]string `json:"genres,omitempty"`
	Copyright             *string   `json:"copyright,omitempty"`
	PhonographicCopyright *string   `json:"phonographic_copyright,omitempty"`
	Label                 *string   `json:"label,omitempty"`
	UPC                   *string   `json:"upc,omitempty"`
	Credits               *[]Credit `json:"credits,omitempty"`
}

type TrackOverride struct {
	Title                 *string   `json:"title,omitempty"`
	Artist                *string   `json:"artist,omitempty"`
	Language              *string   `json:"language,omitempty"`
	Genres                *[]string `json:"genres,omitempty"`
	Copyright             *string   `json:"copyright,omitempty"`
	PhonographicCopyright *string   `json:"phonographic_copyright,omitempty"`
	Label                 *string   `json:"label,omitempty"`
	Explicit              *bool     `json:"explicit,omitempty"`
	Lyrics                *string   `json:"lyrics,omitempty"`
	ISRC                  *string   `json:"isrc,omitempty"`
	Credits               *[]Credit `json:"credits,omitempty"`
}

type Preparation struct {
	Release ReleaseOverride         `json:"release"`
	Tracks  map[int64]TrackOverride `json:"tracks"`
}

type Release struct {
	ProjectID             int64         `json:"project_id"`
	Title                 string        `json:"title"`
	Artist                string        `json:"artist"`
	ReleaseType           string        `json:"release_type"`
	ReleaseDate           string        `json:"release_date"`
	OriginalReleaseDate   string        `json:"original_release_date"`
	Language              string        `json:"language"`
	Genres                []string      `json:"genres"`
	Copyright             string        `json:"copyright"`
	PhonographicCopyright string        `json:"phonographic_copyright"`
	Label                 string        `json:"label"`
	UPC                   string        `json:"upc"`
	Credits               []Credit      `json:"credits"`
	Tracks                []Track       `json:"tracks"`
	Artwork               *Asset        `json:"artwork,omitempty"`
	MotionArtwork         []MotionAsset `json:"motion_artwork"`
}

type MotionAsset struct {
	Kind  string `json:"kind"`
	Asset Asset  `json:"asset"`
}

type Track struct {
	TrackID               int64    `json:"track_id"`
	VersionID             int64    `json:"version_id"`
	Number                int      `json:"number"`
	Title                 string   `json:"title"`
	Artist                string   `json:"artist"`
	Language              string   `json:"language"`
	Genres                []string `json:"genres"`
	Copyright             string   `json:"copyright"`
	PhonographicCopyright string   `json:"phonographic_copyright"`
	Label                 string   `json:"label"`
	Explicit              *bool    `json:"explicit"`
	Lyrics                string   `json:"lyrics"`
	ISRC                  string   `json:"isrc"`
	Credits               []Credit `json:"credits"`
	DurationSeconds       float64  `json:"duration_seconds"`
	Master                *Asset   `json:"master,omitempty"`
}

type Asset struct {
	Path         string `json:"-"`
	Filename     string `json:"filename"`
	Format       string `json:"format"`
	Size         int64  `json:"size"`
	SHA256       string `json:"sha256,omitempty"`
	SourceSHA256 string `json:"source_sha256,omitempty"`
	Derived      bool   `json:"derived"`
	Width        int    `json:"width,omitempty"`
	Height       int    `json:"height,omitempty"`
}

type Issue struct {
	Severity    string `json:"severity"`
	Scope       string `json:"scope"`
	Code        string `json:"code"`
	Field       string `json:"field"`
	Message     string `json:"message"`
	Remediation string `json:"remediation"`
	TrackID     int64  `json:"track_id,omitempty"`
}

type Validation struct {
	CanExport bool    `json:"can_export"`
	CanSend   bool    `json:"can_send"`
	Issues    []Issue `json:"issues"`
}

type ValidationError struct{ Validation Validation }

func (e *ValidationError) Error() string { return ErrAssets.Error() }
func (e *ValidationError) Unwrap() error { return ErrAssets }

type HistoryEntry struct {
	ID             int64     `json:"id"`
	ProjectID      int64     `json:"project_id"`
	Kind           string    `json:"kind"`
	Provider       string    `json:"provider"`
	Environment    string    `json:"environment"`
	Status         string    `json:"status"`
	ProviderStatus string    `json:"provider_status"`
	RemoteID       string    `json:"remote_id"`
	Message        string    `json:"message"`
	Snapshot       Release   `json:"snapshot"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type SnapshotInput struct {
	Snapshot    Release
	Kind        string
	Provider    string
	Environment string
}

type HistoryUpdate struct {
	Status         *string
	RemoteID       *string
	ProviderStatus *string
	Message        *string
}

type Package struct {
	Path      string
	Filename  string
	Snapshot  Release
	HistoryID int64
	dir       string
}

// Cleanup removes only this package's private temporary directory, including staged assets.
func (p *Package) Cleanup() error { return os.RemoveAll(p.dir) }
