package db

import (
	"context"

	sqlc "bungleware/vault/internal/db/sqlc"
)

// Check and delete in one statement so a concurrent move cannot lose its folder.
func (d *DB) DeleteFolderIfEmpty(ctx context.Context, folderID, userID int64) (bool, error) {
	count, err := d.DeleteEmptyFolder(ctx, sqlc.DeleteEmptyFolderParams{ID: folderID, UserID: userID})
	return count > 0, err
}
