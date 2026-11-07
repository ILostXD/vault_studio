package audiometadata

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

type LibraryStatus struct {
	Configured  bool   `json:"configured"`
	Folder      string `json:"folder,omitempty"`
	PublishedAt string `json:"published_at,omitempty"`
	Current     bool   `json:"current"`
	Problem     string `json:"problem,omitempty"`
}

type libraryManifest struct {
	UserID      int64             `json:"user_id"`
	ProjectID   int64             `json:"project_id"`
	Revision    string            `json:"revision"`
	PublishedAt string            `json:"published_at"`
	Files       map[string]string `json:"files"`
	Sizes       map[string]int64  `json:"sizes,omitempty"`
	Tracks      []Track           `json:"tracks"`
}

const manifestName = ".vault-library.json"

func libraryFolder(userID, projectID int64) string {
	// Stable identity avoids collisions and duplicate albums after renaming.
	return fmt.Sprintf("Vault-%d-%d", userID, projectID)
}

func (s *Service) openLibrary() (*os.Root, error) {
	library, err := filepath.EvalSymlinks(s.libraryRoot)
	if err != nil {
		return nil, err
	}
	storage, err := filepath.EvalSymlinks(s.root)
	if err != nil {
		return nil, err
	}
	library, err = filepath.Abs(library)
	if err != nil {
		return nil, err
	}
	storage, err = filepath.Abs(storage)
	if err != nil {
		return nil, err
	}
	relative, err := filepath.Rel(storage, library)
	if err == nil && (relative == "." || filepath.IsLocal(relative)) {
		return nil, fmt.Errorf("%w: the music library must be outside Vault's data directory", ErrInvalid)
	}
	return os.OpenRoot(library)
}

func readManifest(root *os.Root, folder string, userID, projectID int64) (libraryManifest, error) {
	var manifest libraryManifest
	info, err := root.Lstat(folder)
	if err != nil {
		return manifest, err
	}
	if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return manifest, fmt.Errorf("%w: library folder is not a regular directory", ErrInvalid)
	}
	file, err := root.Open(filepath.Join(folder, manifestName))
	if err != nil {
		return manifest, err
	}
	defer file.Close()
	err = json.NewDecoder(io.LimitReader(file, 8<<20)).Decode(&manifest)
	if err != nil || manifest.UserID != userID || manifest.ProjectID != projectID || len(manifest.Files) == 0 {
		return manifest, fmt.Errorf("%w: this library folder is not managed by this project", ErrInvalid)
	}
	return manifest, nil
}

func (s *Service) libraryStatus(userID, projectID int64, revision string) LibraryStatus {
	status := LibraryStatus{Configured: s.libraryRoot != ""}
	if !status.Configured {
		return status
	}
	status.Folder = libraryFolder(userID, projectID)
	root, err := s.openLibrary()
	if err != nil {
		status.Problem = "The music-library folder is unavailable. Check the server mount and permissions."
		return status
	}
	defer root.Close()
	if _, err = root.Lstat(status.Folder); errors.Is(err, os.ErrNotExist) {
		return status
	}
	manifest, err := readManifest(root, status.Folder, userID, projectID)
	if err != nil {
		status.Problem = "The destination contains an unrecognized folder; publishing will not overwrite it."
		return status
	}
	status.PublishedAt = manifest.PublishedAt
	if libraryModified(root, status.Folder, manifest) {
		status.Problem = "Files in the library folder were changed outside Vault. Move that folder aside before publishing again."
		return status
	}
	status.Current = manifest.Revision == revision
	return status
}

// libraryModified is a cheap check (names and sizes, no hashing) so every metadata read stays fast.
// shortcut: a same-size edit is only caught by the hash check at publish time.
func libraryModified(root *os.Root, folder string, manifest libraryManifest) bool {
	dir, err := root.Open(folder)
	if err != nil {
		return true
	}
	entries, err := dir.ReadDir(-1)
	dir.Close()
	if err != nil || len(entries) != len(manifest.Files)+1 {
		return true
	}
	for name, size := range manifest.Sizes {
		info, err := root.Lstat(filepath.Join(folder, name))
		if err != nil || info.Size() != size {
			return true
		}
	}
	for name := range manifest.Files {
		if _, err := root.Lstat(filepath.Join(folder, name)); err != nil {
			return true
		}
	}
	return false
}

// Validate every file before replacing a previous publication. Added or edited
// files belong to the library owner and must never be discarded by republishing.
func verifyManagedFolder(ctx context.Context, root *os.Root, folder string, manifest libraryManifest) error {
	dir, err := root.Open(folder)
	if err != nil {
		return err
	}
	entries, err := dir.ReadDir(-1)
	dir.Close()
	if err != nil {
		return err
	}
	if len(entries) != len(manifest.Files)+1 {
		return fmt.Errorf("%w: library files were added or removed; move that folder aside before publishing", ErrInvalid)
	}
	for _, entry := range entries {
		if entry.Name() == manifestName && entry.Type().IsRegular() {
			continue
		}
		expected, ok := manifest.Files[entry.Name()]
		if !ok || !entry.Type().IsRegular() {
			return fmt.Errorf("%w: unrecognized library file", ErrInvalid)
		}
		file, err := root.Open(filepath.Join(folder, entry.Name()))
		if err != nil {
			return err
		}
		hash := sha256.New()
		_, err = io.Copy(hash, contextReader{ctx: ctx, reader: file})
		file.Close()
		if err != nil {
			return err
		}
		if hex.EncodeToString(hash.Sum(nil)) != expected {
			return fmt.Errorf("%w: a published file was edited outside Vault; move that folder aside before publishing", ErrInvalid)
		}
	}
	return nil
}

func (s *Service) Publish(ctx context.Context, userID, projectID int64, revision string, targetFormat ...string) (LibraryStatus, error) {
	var empty LibraryStatus
	// Bound disk/encoder work and serialize publication swaps in this instance.
	if !s.publishMu.TryLock() {
		return empty, ErrBusy
	}
	defer s.publishMu.Unlock()
	select {
	case s.exports <- struct{}{}:
		defer func() { <-s.exports }()
	default:
		return empty, ErrBusy
	}
	state, err := s.albumSnapshot(ctx, userID, projectID, revision, targetFormat...)
	if err != nil {
		return empty, err
	}
	if s.libraryRoot == "" {
		return empty, fmt.Errorf("%w: the administrator must configure MUSIC_LIBRARY_DIR first", ErrInvalid)
	}
	root, err := s.openLibrary()
	if err != nil {
		return empty, fmt.Errorf("%w: music-library folder is unavailable or not writable", ErrUnavailable)
	}
	defer root.Close()
	folder := libraryFolder(userID, projectID)
	backup := "." + folder + "-previous"
	// Recover an interrupted rename without losing the previous publication.
	if _, err = root.Lstat(backup); err == nil {
		if _, destErr := root.Lstat(folder); !errors.Is(destErr, os.ErrNotExist) {
			return empty, fmt.Errorf("%w: a previous publication backup needs administrator review", ErrInvalid)
		}
		if _, err = readManifest(root, backup, userID, projectID); err != nil {
			return empty, err
		}
		if err = root.Rename(backup, folder); err != nil {
			return empty, err
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return empty, err
	}
	var previous *libraryManifest
	if _, err = root.Lstat(folder); err == nil {
		manifest, err := readManifest(root, folder, userID, projectID)
		if err != nil {
			return empty, fmt.Errorf("%w: refusing to overwrite an unrecognized library folder", ErrInvalid)
		}
		if err = verifyManagedFolder(ctx, root, folder, manifest); err != nil {
			return empty, err
		}
		previous = &manifest
	} else if !errors.Is(err, os.ErrNotExist) {
		return empty, err
	}
	stage := ".vault-staging-" + rand.Text()
	if err = root.Mkdir(stage, 0755); err != nil {
		return empty, err
	}
	defer root.RemoveAll(stage)
	manifest := libraryManifest{UserID: userID, ProjectID: projectID, Revision: revision, PublishedAt: time.Now().UTC().Format(time.RFC3339), Files: map[string]string{}, Sizes: map[string]int64{}, Tracks: state.Tracks}
	err = s.albumFiles(ctx, state, func(name string, source io.Reader) error {
		file, err := root.OpenFile(filepath.Join(stage, name), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
		if err != nil {
			return err
		}
		hash := sha256.New()
		written, copyErr := io.Copy(io.MultiWriter(file, hash), source)
		syncErr := file.Sync()
		closeErr := file.Close()
		if err = errors.Join(copyErr, syncErr, closeErr); err != nil {
			return err
		}
		manifest.Files[name] = hex.EncodeToString(hash.Sum(nil))
		manifest.Sizes[name] = written
		return nil
	})
	if err != nil {
		return empty, err
	}
	data, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return empty, err
	}
	if err = root.WriteFile(filepath.Join(stage, manifestName), data, 0644); err != nil {
		return empty, err
	}
	if _, err = s.albumSnapshot(ctx, userID, projectID, revision, targetFormat...); err != nil {
		return empty, err
	}
	if previous != nil {
		if err = verifyManagedFolder(ctx, root, folder, *previous); err != nil {
			return empty, err
		}
		if err = root.Rename(folder, backup); err != nil {
			return empty, err
		}
	} else if _, err = root.Lstat(folder); !errors.Is(err, os.ErrNotExist) {
		return empty, fmt.Errorf("%w: destination appeared during publication", ErrInvalid)
	}
	if err = root.Rename(stage, folder); err != nil {
		if previous != nil {
			err = errors.Join(err, root.Rename(backup, folder))
		}
		return empty, err
	}
	if previous != nil {
		if err = root.RemoveAll(backup); err != nil {
			return empty, fmt.Errorf("publication succeeded but its previous backup could not be removed: %w", err)
		}
	}
	return s.libraryStatus(userID, projectID, revision), nil
}
