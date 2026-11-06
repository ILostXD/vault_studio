package audiometadata

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"bungleware/vault/internal/fileutil"
)

// The revision pins the ordered tracks, versions, tags and artwork to the preview.
func (s *Service) revision(state State) string {
	data, _ := json.Marshal(struct {
		Metadata     Fields
		Tracks       []Track
		TargetFormat string
	}{state.Metadata, state.Tracks, state.TargetFormat})
	h := sha256.New()
	h.Write(data)
	for _, track := range state.Tracks {
		for _, path := range []string{track.sourcePath, track.coverPath} {
			if info, err := os.Stat(path); err == nil {
				fmt.Fprintf(h, "%s:%d:%d;", path, info.Size(), info.ModTime().UnixNano())
			}
		}
	}
	return hex.EncodeToString(h.Sum(nil))
}

func (s *Service) albumSnapshot(ctx context.Context, userID, projectID int64, revision string, targetFormat ...string) (State, error) {
	state, err := s.Resolve(ctx, userID, projectID, targetFormat...)
	if err != nil {
		return state, err
	}
	if revision == "" || revision != state.Revision {
		return state, fmt.Errorf("%w: the album changed; refresh the preview", ErrInvalid)
	}
	if len(state.Tracks) == 0 {
		return state, fmt.Errorf("%w: the album has no tracks", ErrInvalid)
	}
	for _, track := range state.Tracks {
		if !track.CanDownload {
			return state, fmt.Errorf("%w: %s has no available source", ErrUnavailable, track.Title)
		}
	}
	return state, nil
}

func (s *Service) BuildAlbum(ctx context.Context, userID, projectID int64, revision string, targetFormat ...string) (_ *Export, err error) {
	select {
	case s.exports <- struct{}{}:
		defer func() { <-s.exports }()
	default:
		return nil, ErrBusy
	}
	state, err := s.albumSnapshot(ctx, userID, projectID, revision, targetFormat...)
	if err != nil {
		return nil, err
	}
	dir, err := os.MkdirTemp("", "vault-tagged-album-")
	if err != nil {
		return nil, err
	}
	export := &Export{dir: dir, Path: filepath.Join(dir, "album.zip"), Filename: fileutil.SanitizeFilename(state.Metadata.Album) + ".zip"}
	defer func() {
		if err != nil {
			export.Cleanup()
		}
	}()
	file, err := os.Create(export.Path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	archive := zip.NewWriter(file)
	defer archive.Close()
	err = s.albumFiles(ctx, state, func(name string, source io.Reader) error {
		entry, err := archive.CreateHeader(&zip.FileHeader{Name: name, Method: zip.Store})
		if err != nil {
			return err
		}
		_, err = io.Copy(entry, source)
		return err
	})
	if err != nil {
		return nil, err
	}
	if _, err = s.albumSnapshot(ctx, userID, projectID, revision, targetFormat...); err != nil {
		return nil, err
	}
	if err = archive.Close(); err != nil {
		return nil, err
	}
	if err = file.Close(); err != nil {
		return nil, err
	}
	return export, nil
}

// Generate one derivative at a time; no album-sized audio buffers or hardlinks.
func (s *Service) albumFiles(ctx context.Context, state State, write func(string, io.Reader) error) error {
	for _, track := range state.Tracks {
		export, err := s.buildResolvedTrack(ctx, track)
		if err != nil {
			return err
		}
		err = func() error {
			defer export.Cleanup()
			file, err := os.Open(export.Path)
			if err != nil {
				return err
			}
			defer file.Close()
			return write(export.Filename, contextReader{ctx: ctx, reader: file})
		}()
		if err != nil {
			return err
		}
	}
	if state.Artwork && len(state.Tracks) > 0 {
		cover, err := s.coverPNG(ctx, state.Tracks[0].coverPath)
		if err != nil {
			return err
		}
		return write("cover.png", bytes.NewReader(cover))
	}
	return nil
}
