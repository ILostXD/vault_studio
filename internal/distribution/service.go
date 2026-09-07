package distribution

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	db "bungleware/vault/internal/db/sqlc"
)

type Service struct {
	queries *db.Queries
	root    string
}

func NewService(queries *db.Queries, storageRoot string) *Service {
	return &Service{queries: queries, root: storageRoot}
}

func (s *Service) owner(ctx context.Context, userID, projectID int64) (db.Project, error) {
	p, err := s.queries.GetProject(ctx, db.GetProjectParams{ID: projectID, UserID: userID})
	if errors.Is(err, sql.ErrNoRows) {
		return p, ErrNotFound
	}
	return p, err
}

func (s *Service) GetProfile(ctx context.Context, userID int64) (ArtistProfile, error) {
	p := ArtistProfile{DefaultCredits: []Credit{}}
	r, err := s.queries.GetDistributionProfile(ctx, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return p, nil
	}
	if err != nil {
		return p, err
	}
	err = json.Unmarshal([]byte(r.ProfileJson), &p)
	return p, err
}

func (s *Service) SaveProfile(ctx context.Context, userID int64, p ArtistProfile) (ArtistProfile, error) {
	p.DisplayName = strings.TrimSpace(p.DisplayName)
	p.LegalName = strings.TrimSpace(p.LegalName)
	p.DefaultCredits = cleanCredits(p.DefaultCredits)
	data, err := encodeInput(p)
	if err != nil {
		return p, err
	}
	err = s.queries.SaveDistributionProfile(ctx, db.SaveDistributionProfileParams{UserID: userID, ProfileJson: data})
	return p, err
}

func (s *Service) GetPreparation(ctx context.Context, userID, projectID int64) (Preparation, error) {
	p := Preparation{Tracks: map[int64]TrackOverride{}}
	if _, err := s.owner(ctx, userID, projectID); err != nil {
		return p, err
	}
	r, err := s.queries.GetDistributionPreparation(ctx, db.GetDistributionPreparationParams{ProjectID: projectID, UserID: userID})
	if errors.Is(err, sql.ErrNoRows) {
		return p, nil
	}
	if err != nil {
		return p, err
	}
	err = json.Unmarshal([]byte(r.PreparationJson), &p)
	if p.Tracks == nil {
		p.Tracks = map[int64]TrackOverride{}
	}
	return p, err
}

func (s *Service) SavePreparation(ctx context.Context, userID, projectID int64, p Preparation) (Preparation, error) {
	if _, err := s.owner(ctx, userID, projectID); err != nil {
		return p, err
	}
	tracks, err := s.queries.ListDistributionTracks(ctx, db.ListDistributionTracksParams{ID: projectID, UserID: userID})
	if err != nil {
		return p, err
	}
	allowed := make(map[int64]bool, len(tracks))
	for _, t := range tracks {
		allowed[t.ID] = true
	}
	for id := range p.Tracks {
		if !allowed[id] {
			return p, fmt.Errorf("%w: track does not belong to project", ErrInvalid)
		}
	}
	if p.Tracks == nil {
		p.Tracks = map[int64]TrackOverride{}
	}
	data, err := encodeInput(p)
	if err != nil {
		return p, err
	}
	n, err := s.queries.SaveDistributionPreparation(ctx, db.SaveDistributionPreparationParams{ProjectID: projectID, UserID: userID, PreparationJson: data})
	if err == nil && n == 0 {
		err = ErrNotFound
	}
	return p, err
}

func (s *Service) Resolve(ctx context.Context, userID, projectID int64) (Release, error) {
	r := Release{ProjectID: projectID, Tracks: []Track{}, MotionArtwork: []MotionAsset{}}
	project, err := s.owner(ctx, userID, projectID)
	if err != nil {
		return r, err
	}
	prep, err := s.GetPreparation(ctx, userID, projectID)
	if err != nil {
		return r, err
	}
	profile, err := s.GetProfile(ctx, userID)
	if err != nil {
		return r, err
	}
	o := prep.Release
	r.Title = value(o.Title, project.Name)
	r.Artist = value(o.Artist, first(project.AuthorOverride.String, profile.DisplayName))
	r.ReleaseType = value(o.ReleaseType, "")
	r.ReleaseDate = value(o.ReleaseDate, project.EstimatedReleaseDate.String)
	r.OriginalReleaseDate = value(o.OriginalReleaseDate, "")
	r.Language = value(o.Language, "")
	r.Genres = genres(o.Genres, nil)
	r.Copyright = value(o.Copyright, "")
	r.PhonographicCopyright = value(o.PhonographicCopyright, "")
	r.Label = value(o.Label, "")
	r.UPC = value(o.UPC, "")
	r.Credits = credits(o.Credits, profile.DefaultCredits)
	if project.CoverArtPath.Valid && project.CoverArtPath.String != "" {
		r.Artwork = assetFromPath(project.CoverArtPath.String, "cover")
	}
	motion, err := s.queries.ListProjectMotionAssets(ctx, projectID)
	if err != nil {
		return r, err
	}
	for _, source := range motion {
		asset := assetFromPath(source.SourcePath, source.Kind)
		if asset != nil {
			asset.Width, asset.Height = int(source.Width), int(source.Height)
			r.MotionArtwork = append(r.MotionArtwork, MotionAsset{Kind: source.Kind, Asset: *asset})
		}
	}
	tracks, err := s.queries.ListDistributionTracks(ctx, db.ListDistributionTracksParams{ID: projectID, UserID: userID})
	if err != nil {
		return r, err
	}
	for i, source := range tracks {
		o := prep.Tracks[source.ID]
		t := Track{TrackID: source.ID, VersionID: source.ActiveVersionID.Int64, Number: i + 1,
			Title: value(o.Title, source.Title), Artist: value(o.Artist, first(source.Artist.String, r.Artist)),
			Language: value(o.Language, r.Language), Genres: genres(o.Genres, r.Genres),
			Copyright: value(o.Copyright, r.Copyright), PhonographicCopyright: value(o.PhonographicCopyright, r.PhonographicCopyright),
			Label: value(o.Label, r.Label), Explicit: o.Explicit, Lyrics: value(o.Lyrics, ""), ISRC: value(o.ISRC, ""),
			Credits: credits(o.Credits, r.Credits), DurationSeconds: source.DurationSeconds.Float64}
		if source.FileID.Valid {
			t.Master = &Asset{Path: source.FilePath.String, Format: strings.ToLower(source.Format.String), Size: source.FileSize.Int64}
		}
		r.Tracks = append(r.Tracks, t)
	}
	return r, nil
}

func assetFromPath(path, fallback string) *Asset {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil
	}
	info, _ := os.Stat(path)
	size := int64(0)
	if info != nil {
		size = info.Size()
	}
	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(path)), ".")
	name := filepath.Base(path)
	if name == "." || name == string(filepath.Separator) || name == "" {
		name = fallback + extWithDot(ext)
	}
	return &Asset{Path: path, Filename: name, Format: ext, Size: size}
}

func extWithDot(ext string) string {
	if ext == "" {
		return ""
	}
	return "." + ext
}

func (s *Service) Validate(ctx context.Context, userID, projectID int64) (Release, Validation, error) {
	release, err := s.Resolve(ctx, userID, projectID)
	if err != nil {
		return release, Validation{}, err
	}
	issues := []Issue{}
	add := func(severity, code, field, message, remediation string, trackID int64) {
		issues = append(issues, Issue{Severity: severity, Scope: "vault", Code: code, Field: field, Message: message, Remediation: remediation, TrackID: trackID})
	}
	if release.Title == "" {
		add("error", "release.title_missing", "release.title", "Add a release title.", "fix_in_vault", 0)
	}
	if release.Artist == "" {
		add("error", "release.artist_missing", "release.artist", "Add the primary artist.", "fix_in_vault", 0)
	}
	if len(release.Tracks) == 0 {
		add("error", "release.tracks_missing", "tracks", "Add at least one track.", "fix_in_vault", 0)
	}
	if release.ReleaseType == "" {
		add("warning", "release.type_missing", "release.release_type", "Choose a release type before sending to a distributor.", "fix_in_vault", 0)
	}
	if release.ReleaseDate == "" {
		add("warning", "release.date_missing", "release.release_date", "Choose a release date before distribution.", "fix_in_vault", 0)
	} else if !validDate(release.ReleaseDate) {
		add("error", "release.date_invalid", "release.release_date", "Use a valid release date in YYYY-MM-DD format.", "fix_in_vault", 0)
	}
	if release.OriginalReleaseDate != "" && !validDate(release.OriginalReleaseDate) {
		add("error", "release.original_date_invalid", "release.original_release_date", "Use a valid original release date in YYYY-MM-DD format.", "fix_in_vault", 0)
	}
	if release.UPC != "" && !validUPC(release.UPC) {
		add("error", "release.upc_invalid", "release.upc", "UPC/EAN must contain 12, 13, or 14 digits.", "fix_in_vault", 0)
	}
	if release.Language == "" {
		add("warning", "release.language_missing", "release.language", "Add the metadata language before distribution.", "fix_in_vault", 0)
	}
	if len(release.Credits) == 0 {
		add("warning", "release.credits_missing", "release.credits", "Add reusable credits to avoid entering them for every track.", "fix_in_vault", 0)
	}
	if release.Artwork == nil {
		add("warning", "release.artwork_missing", "release.artwork", "Add square cover artwork before distribution.", "fix_in_vault", 0)
	}
	if release.Artwork != nil {
		path, pathErr := s.assetPath(release.Artwork.Path)
		if pathErr != nil {
			add("error", "release.artwork_unavailable", "release.artwork", "The stored cover artwork is unavailable.", "fix_in_vault", 0)
		} else if f, openErr := os.Open(path); openErr == nil {
			cfg, _, decodeErr := image.DecodeConfig(f)
			_ = f.Close()
			if decodeErr == nil {
				release.Artwork.Width, release.Artwork.Height = cfg.Width, cfg.Height
			}
			if decodeErr != nil || cfg.Width != cfg.Height || cfg.Width < 3000 || cfg.Width > 5000 {
				add("warning", "release.artwork_spec", "release.artwork", "Distributors commonly require square RGB artwork between 3000 and 5000 pixels.", "fix_in_vault", 0)
			}
		}
	}
	for i := range release.MotionArtwork {
		if _, pathErr := s.assetPath(release.MotionArtwork[i].Asset.Path); pathErr != nil {
			add("error", "release.motion_artwork_unavailable", "release.motion_artwork", "Stored motion artwork is unavailable.", "fix_in_vault", 0)
		}
	}
	seenISRC := map[string]int64{}
	for i := range release.Tracks {
		t := &release.Tracks[i]
		field := "tracks." + strconv.FormatInt(t.TrackID, 10)
		if t.Title == "" {
			add("error", "track.title_missing", field+".title", "Add a track title.", "fix_in_vault", t.TrackID)
		}
		if t.Master == nil || t.VersionID == 0 {
			add("error", "track.master_missing", field+".master", "Select an active source master.", "fix_in_vault", t.TrackID)
			continue
		}
		if _, pathErr := s.assetPath(t.Master.Path); pathErr != nil {
			add("error", "track.master_unavailable", field+".master", "The active source master is unavailable.", "fix_in_vault", t.TrackID)
		}
		if t.Language == "" {
			add("warning", "track.language_missing", field+".language", "Add a track metadata language before distribution.", "fix_in_vault", t.TrackID)
		}
		if t.Explicit == nil {
			add("warning", "track.explicit_unknown", field+".explicit", "Mark the track explicit or clean before distribution.", "fix_in_vault", t.TrackID)
		}
		if len(t.Credits) == 0 {
			add("warning", "track.credits_missing", field+".credits", "Add at least one writer or composer credit before distribution.", "fix_in_vault", t.TrackID)
		}
		if t.ISRC != "" {
			normalized := normalizeISRC(t.ISRC)
			if !validISRC(normalized) {
				add("error", "track.isrc_invalid", field+".isrc", "ISRC must contain a two-letter country, three-character registrant, two-digit year, and five-digit designation.", "fix_in_vault", t.TrackID)
			} else if previous, exists := seenISRC[normalized]; exists {
				add("error", "track.isrc_duplicate", field+".isrc", fmt.Sprintf("This ISRC is also assigned to track %d.", previous), "fix_in_vault", t.TrackID)
			} else {
				seenISRC[normalized] = t.TrackID
			}
		}
	}
	canExport := true
	for _, issue := range issues {
		if issue.Severity == "error" {
			canExport = false
			break
		}
	}
	return release, Validation{CanExport: canExport, CanSend: canExport, Issues: issues}, nil
}

func (s *Service) assetPath(path string) (string, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	root, err := filepath.Abs(s.root)
	if err != nil {
		return "", err
	}
	abs, err = filepath.EvalSymlinks(abs)
	if err != nil {
		return "", ErrAssets
	}
	root, err = filepath.EvalSymlinks(root)
	if err != nil {
		return "", ErrAssets
	}
	rel, err := filepath.Rel(root, abs)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", ErrAssets
	}
	info, err := os.Stat(abs)
	if err != nil || !info.Mode().IsRegular() {
		return "", ErrAssets
	}
	return abs, nil
}

// Snapshot resolves current project data and hashes the exact source assets referenced by the operation.
func (s *Service) Snapshot(ctx context.Context, userID, projectID int64) (Release, Validation, error) {
	release, validation, err := s.Validate(ctx, userID, projectID)
	if err != nil {
		return release, validation, err
	}
	for i := range release.Tracks {
		if release.Tracks[i].Master == nil {
			continue
		}
		path, pathErr := s.assetPath(release.Tracks[i].Master.Path)
		if pathErr != nil {
			continue
		}
		release.Tracks[i].Master.SHA256, err = hashFile(path)
		if err != nil {
			return release, validation, err
		}
		release.Tracks[i].Master.Filename = fmt.Sprintf("%02d - %s%s", release.Tracks[i].Number, safeName(release.Tracks[i].Title), fileExt(path, release.Tracks[i].Master.Format))
	}
	if release.Artwork != nil {
		path, pathErr := s.assetPath(release.Artwork.Path)
		if pathErr == nil {
			release.Artwork.SHA256, err = hashFile(path)
			if err != nil {
				return release, validation, err
			}
			release.Artwork.Filename = "cover" + fileExt(path, release.Artwork.Format)
		}
	}
	for i := range release.MotionArtwork {
		path, pathErr := s.assetPath(release.MotionArtwork[i].Asset.Path)
		if pathErr != nil {
			continue
		}
		release.MotionArtwork[i].Asset.SHA256, err = hashFile(path)
		if err != nil {
			return release, validation, err
		}
		release.MotionArtwork[i].Asset.Filename = motionFilename(release.MotionArtwork[i].Kind, path)
	}
	return release, validation, nil
}

// PrepareFLAC returns the original FLAC or a disposable derived file without changing the master.
func (s *Service) PrepareFLAC(ctx context.Context, asset Asset) (string, func(), error) {
	path, err := s.assetPath(asset.Path)
	if err != nil {
		return "", func() {}, err
	}
	if strings.EqualFold(strings.TrimPrefix(asset.Format, "."), "flac") || strings.EqualFold(filepath.Ext(path), ".flac") {
		return path, func() {}, nil
	}
	dir, err := os.MkdirTemp("", "vault-toolost-audio-")
	if err != nil {
		return "", func() {}, err
	}
	cleanup := func() { _ = os.RemoveAll(dir) }
	out := filepath.Join(dir, "upload.flac")
	output, err := exec.CommandContext(ctx, "ffmpeg", "-v", "error", "-i", path, "-vn", "-c:a", "flac", "-y", out).CombinedOutput()
	if err != nil {
		cleanup()
		return "", func() {}, fmt.Errorf("derive FLAC: %w: %s", err, strings.TrimSpace(string(output)))
	}
	return out, cleanup, nil
}

// BuildPackage creates a private temporary ZIP and records exactly what it contains.
func (s *Service) BuildPackage(ctx context.Context, userID, projectID int64) (*Package, Validation, error) {
	release, validation, err := s.Snapshot(ctx, userID, projectID)
	if err != nil {
		return nil, validation, err
	}
	if !validation.CanExport {
		return nil, validation, &ValidationError{Validation: validation}
	}
	dir, err := os.MkdirTemp("", "vault-release-")
	if err != nil {
		return nil, validation, err
	}
	pkg := &Package{dir: dir, Path: filepath.Join(dir, "release-package.zip"), Filename: safeName(release.Title) + "-release-package.zip"}
	cleanup := true
	defer func() {
		if cleanup {
			_ = pkg.Cleanup()
		}
	}()
	pkg.Snapshot = release
	if err = writePackage(pkg.Path, release, validation); err != nil {
		return nil, validation, err
	}
	history, err := s.RecordSnapshot(ctx, userID, projectID, SnapshotInput{Snapshot: release, Kind: "export"})
	if err != nil {
		return nil, validation, err
	}
	status := "succeeded"
	history, err = s.UpdateHistory(ctx, userID, projectID, history.ID, HistoryUpdate{Status: &status})
	if err != nil {
		return nil, validation, err
	}
	pkg.HistoryID = history.ID
	cleanup = false
	return pkg, validation, nil
}

func writePackage(path string, release Release, validation Validation) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	zw := zip.NewWriter(f)
	checks := []string{}
	addFile := func(name, source string) error {
		in, err := os.Open(source)
		if err != nil {
			return err
		}
		defer in.Close()
		w, err := zw.Create(name)
		if err != nil {
			return err
		}
		if _, err = io.Copy(w, in); err != nil {
			return err
		}
		h, err := hashFile(source)
		if err == nil {
			checks = append(checks, h+"  "+name)
		}
		return err
	}
	addBytes := func(name string, data []byte) error {
		w, err := zw.Create(name)
		if err == nil {
			_, err = w.Write(data)
		}
		if err == nil {
			sum := sha256.Sum256(data)
			checks = append(checks, hex.EncodeToString(sum[:])+"  "+name)
		}
		return err
	}
	for _, t := range release.Tracks {
		if err = addFile("Audio/"+t.Master.Filename, t.Master.Path); err != nil {
			break
		}
	}
	if err == nil && release.Artwork != nil {
		err = addFile("Artwork/"+release.Artwork.Filename, release.Artwork.Path)
	}
	if err == nil {
		for _, m := range release.MotionArtwork {
			if err = addFile("Artwork/"+m.Asset.Filename, m.Asset.Path); err != nil {
				break
			}
		}
	}
	manifest, _ := json.MarshalIndent(struct {
		Version    int        `json:"version"`
		CreatedAt  time.Time  `json:"created_at"`
		Release    Release    `json:"release"`
		Validation Validation `json:"validation"`
	}{1, time.Now().UTC(), release, validation}, "", "  ")
	if err == nil {
		err = addBytes("Metadata/release.json", manifest)
	}
	if err == nil {
		data, csvErr := tracksCSV(release)
		if csvErr != nil {
			err = csvErr
		} else {
			err = addBytes("Metadata/tracks.csv", data)
		}
	}
	if err == nil {
		data, csvErr := creditsCSV(release)
		if csvErr != nil {
			err = csvErr
		} else {
			err = addBytes("Credits/credits.csv", data)
		}
	}
	if err == nil {
		err = addBytes("README.txt", []byte(readme(release, validation)))
	}
	if err == nil {
		sort.Strings(checks)
		w, createErr := zw.Create("checksums.sha256")
		if createErr != nil {
			err = createErr
		} else {
			_, err = w.Write([]byte(strings.Join(checks, "\n") + "\n"))
		}
	}
	closeErr := zw.Close()
	fileErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return fileErr
}

func tracksCSV(r Release) ([]byte, error) {
	var b bytes.Buffer
	w := csv.NewWriter(&b)
	_ = w.Write([]string{"track_number", "title", "artist", "filename", "language", "explicit", "isrc", "duration_seconds"})
	for _, t := range r.Tracks {
		explicit := "unknown"
		if t.Explicit != nil {
			explicit = strconv.FormatBool(*t.Explicit)
		}
		_ = w.Write([]string{strconv.Itoa(t.Number), t.Title, t.Artist, t.Master.Filename, t.Language, explicit, t.ISRC, strconv.FormatFloat(t.DurationSeconds, 'f', 3, 64)})
	}
	w.Flush()
	return b.Bytes(), w.Error()
}
func creditsCSV(r Release) ([]byte, error) {
	var b bytes.Buffer
	w := csv.NewWriter(&b)
	_ = w.Write([]string{"scope", "track_number", "name", "role"})
	for _, c := range r.Credits {
		_ = w.Write([]string{"release", "", c.Name, c.Role})
	}
	for _, t := range r.Tracks {
		for _, c := range t.Credits {
			_ = w.Write([]string{"track", strconv.Itoa(t.Number), c.Name, c.Role})
		}
	}
	w.Flush()
	return b.Bytes(), w.Error()
}
func readme(r Release, v Validation) string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s — %s\n\nThis package was prepared by Vault Studio from the project's active source masters. Original files in Vault were not modified.\n\nComplete distributor-specific settings such as stores, territories, licenses, and final submission in your distributor.\n", r.Title, r.Artist)
	if len(v.Issues) > 0 {
		b.WriteString("\nNeeds attention:\n")
		for _, i := range v.Issues {
			fmt.Fprintf(&b, "- %s\n", i.Message)
		}
	}
	return b.String()
}
func hashFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err = io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
func safeName(v string) string {
	v = strings.TrimSpace(v)
	replacer := strings.NewReplacer("<", "-", ">", "-", ":", "-", "\"", "-", "/", "-", "\\", "-", "|", "-", "?", "-", "*", "-")
	v = replacer.Replace(v)
	v = strings.Map(func(r rune) rune {
		if r < 32 || r == 127 {
			return '-'
		}
		return r
	}, v)
	if v == "" {
		return "release"
	}
	return v
}
func fileExt(path, format string) string {
	ext := strings.ToLower(filepath.Ext(path))
	if ext != "" {
		return ext
	}
	return extWithDot(strings.TrimPrefix(strings.ToLower(format), "."))
}
func motionFilename(kind, path string) string {
	base := map[string]string{"apple_square": "apple-motion-1x1", "apple_portrait": "apple-motion-3x4", "spotify_canvas": "spotify-canvas"}[kind]
	if base == "" {
		base = safeName(kind)
	}
	return base + fileExt(path, "")
}

func (s *Service) History(ctx context.Context, userID, projectID int64) ([]HistoryEntry, error) {
	if _, err := s.owner(ctx, userID, projectID); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListDistributionHistory(ctx, db.ListDistributionHistoryParams{ProjectID: projectID, UserID: userID})
	if err != nil {
		return nil, err
	}
	entries := make([]HistoryEntry, 0, len(rows))
	for _, row := range rows {
		e, err := historyEntry(row)
		if err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, nil
}

func (s *Service) GetHistory(ctx context.Context, userID, projectID, historyID int64) (HistoryEntry, error) {
	row, err := s.queries.GetDistributionHistory(ctx, db.GetDistributionHistoryParams{ID: historyID, ProjectID: projectID, UserID: userID})
	if errors.Is(err, sql.ErrNoRows) {
		return HistoryEntry{}, ErrNotFound
	}
	if err != nil {
		return HistoryEntry{}, err
	}
	return historyEntry(row)
}

func (s *Service) UpdateRemoteStatus(ctx context.Context, userID, projectID, historyID int64, status, message string) (HistoryEntry, error) {
	row, err := s.queries.UpdateDistributionRemoteStatus(ctx, db.UpdateDistributionRemoteStatusParams{ProviderStatus: strings.TrimSpace(status), Message: strings.TrimSpace(message), ID: historyID, ProjectID: projectID, UserID: userID})
	if errors.Is(err, sql.ErrNoRows) {
		return HistoryEntry{}, ErrNotFound
	}
	if err != nil {
		return HistoryEntry{}, err
	}
	return historyEntry(row)
}

// RecordSnapshot persists a pending operation before a provider network call.
// Pass Package.Snapshot so the metadata and hashes describe the staged bytes sent.
func (s *Service) RecordSnapshot(ctx context.Context, userID, projectID int64, input SnapshotInput) (HistoryEntry, error) {
	if _, err := s.owner(ctx, userID, projectID); err != nil {
		return HistoryEntry{}, err
	}
	if input.Snapshot.ProjectID != projectID || (input.Kind != "export" && input.Kind != "send") {
		return HistoryEntry{}, ErrInvalid
	}
	if input.Kind == "send" && strings.TrimSpace(input.Provider) == "" {
		return HistoryEntry{}, ErrInvalid
	}
	data, err := encodeInput(input.Snapshot)
	if err != nil {
		return HistoryEntry{}, err
	}
	row, err := s.queries.CreateDistributionHistory(ctx, db.CreateDistributionHistoryParams{
		ProjectID: projectID, UserID: userID, Kind: input.Kind, Provider: input.Provider, Environment: input.Environment, SnapshotJson: data})
	if err != nil {
		return HistoryEntry{}, err
	}
	return historyEntry(row)
}

func (s *Service) UpdateHistory(ctx context.Context, userID, projectID, historyID int64, update HistoryUpdate) (HistoryEntry, error) {
	if _, err := s.owner(ctx, userID, projectID); err != nil {
		return HistoryEntry{}, err
	}
	if update.Status != nil && *update.Status != "pending" && *update.Status != "succeeded" && *update.Status != "failed" {
		return HistoryEntry{}, ErrInvalid
	}
	if update.RemoteID != nil && strings.TrimSpace(*update.RemoteID) == "" {
		return HistoryEntry{}, ErrInvalid
	}
	row, err := s.queries.UpdateDistributionHistory(ctx, db.UpdateDistributionHistoryParams{
		ID: historyID, ProjectID: projectID, UserID: userID, Status: nullable(update.Status), RemoteID: nullable(update.RemoteID), ProviderStatus: nullable(update.ProviderStatus), Message: nullable(update.Message)})
	if errors.Is(err, sql.ErrNoRows) {
		return HistoryEntry{}, ErrNotFound
	}
	if err != nil {
		return HistoryEntry{}, err
	}
	return historyEntry(row)
}

func historyEntry(r db.DistributionHistory) (HistoryEntry, error) {
	e := HistoryEntry{ID: r.ID, ProjectID: r.ProjectID, Kind: r.Kind, Provider: r.Provider, Environment: r.Environment,
		Status: r.Status, ProviderStatus: r.ProviderStatus, RemoteID: r.RemoteID, Message: r.Message, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt}
	err := json.Unmarshal([]byte(r.SnapshotJson), &e.Snapshot)
	return e, err
}

func nullable(v *string) sql.NullString {
	if v == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *v, Valid: true}
}
func value(v *string, fallback string) string {
	if v != nil {
		return strings.TrimSpace(*v)
	}
	return strings.TrimSpace(fallback)
}
func first(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
func genres(v *[]string, fallback []string) []string {
	if v != nil {
		fallback = *v
	}
	return cleanStrings(fallback)
}
func credits(v *[]Credit, fallback []Credit) []Credit {
	if v != nil {
		fallback = *v
	}
	return cleanCredits(fallback)
}
func cleanCredits(values []Credit) []Credit {
	out := []Credit{}
	seen := map[Credit]bool{}
	for _, c := range values {
		c.Name, c.Role = strings.TrimSpace(c.Name), strings.TrimSpace(c.Role)
		if c.Name == "" || c.Role == "" {
			continue
		}
		if !seen[c] {
			out = append(out, c)
			seen[c] = true
		}
	}
	return out
}

func cleanStrings(values []string) []string {
	out := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		key := strings.ToLower(value)
		if value != "" && !seen[key] {
			out = append(out, value)
			seen[key] = true
		}
	}
	return out
}

func validDate(value string) bool {
	parsed, err := time.Parse("2006-01-02", value)
	return err == nil && parsed.Format("2006-01-02") == value
}

func validUPC(value string) bool {
	value = strings.TrimSpace(value)
	if len(value) != 12 && len(value) != 13 && len(value) != 14 {
		return false
	}
	for _, char := range value {
		if char < '0' || char > '9' {
			return false
		}
	}
	return true
}

func normalizeISRC(value string) string {
	return strings.ToUpper(strings.NewReplacer("-", "", " ", "").Replace(strings.TrimSpace(value)))
}

func validISRC(value string) bool {
	if len(value) != 12 {
		return false
	}
	for index, char := range value {
		if index < 2 && (char < 'A' || char > 'Z') {
			return false
		}
		if index >= 5 && (char < '0' || char > '9') {
			return false
		}
		if index >= 2 && index < 5 && !((char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9')) {
			return false
		}
	}
	return true
}
func encodeInput(v any) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	if len(b) > 2<<20 {
		return "", fmt.Errorf("%w: metadata exceeds 2 MiB", ErrInvalid)
	}
	return string(b), nil
}
