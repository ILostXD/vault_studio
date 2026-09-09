package db

import (
	"context"
	"database/sql"
	"errors"
	"time"

	sqlc "bungleware/vault/internal/db/sqlc"
)

// IsFolderEmpty checks if a folder has 0 projects, 0 subfolders, 0 shared projects, and 0 shared tracks.
func (d *DB) IsFolderEmpty(ctx context.Context, folderID int64, userID int64) (bool, error) {
	fID := sql.NullInt64{Int64: folderID, Valid: true}

	// 1. Projects in folder
	projCount, err := d.CountProjectsInFolder(ctx, fID)
	if err != nil {
		return false, err
	}
	if projCount > 0 {
		return false, nil
	}

	// 2. Subfolders in folder
	subCount, err := d.CountSubfoldersInFolder(ctx, fID)
	if err != nil {
		return false, err
	}
	if subCount > 0 {
		return false, nil
	}

	// 3. Shared projects organized into this folder
	sharedProjs, err := d.ListSharedProjectOrganizationsInFolder(ctx, sqlc.ListSharedProjectOrganizationsInFolderParams{
		UserID:   userID,
		FolderID: fID,
	})
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false, err
	}
	if len(sharedProjs) > 0 {
		return false, nil
	}

	// 4. Shared tracks organized into this folder
	sharedTracks, err := d.ListSharedTrackOrganizationsInFolder(ctx, sqlc.ListSharedTrackOrganizationsInFolderParams{
		UserID:   userID,
		FolderID: fID,
	})
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false, err
	}
	if len(sharedTracks) > 0 {
		return false, nil
	}

	return true, nil
}

// DeleteFolderIfEmpty checks if a folder has 0 items and deletes it if empty.
func (d *DB) DeleteFolderIfEmpty(ctx context.Context, folderID int64, userID int64) (bool, error) {
	empty, err := d.IsFolderEmpty(ctx, folderID, userID)
	if err != nil || !empty {
		return false, err
	}

	err = d.DeleteFolder(ctx, sqlc.DeleteFolderParams{
		ID:     folderID,
		UserID: userID,
	})
	if err != nil {
		return false, err
	}
	return true, nil
}

// CleanupEmptyFolders prunes any empty folders for the user that are older than the given grace period.
func (d *DB) CleanupEmptyFolders(ctx context.Context, userID int64, gracePeriod time.Duration) error {
	folders, err := d.ListAllFoldersByUser(ctx, userID)
	if err != nil {
		return err
	}

	now := time.Now()
	for _, f := range folders {
		if f.CreatedAt.Valid && now.Sub(f.CreatedAt.Time) < gracePeriod {
			continue
		}
		empty, err := d.IsFolderEmpty(ctx, f.ID, userID)
		if err == nil && empty {
			_ = d.DeleteFolder(ctx, sqlc.DeleteFolderParams{
				ID:     f.ID,
				UserID: userID,
			})
		}
	}
	return nil
}
