package db

import (
	"context"
	"testing"

	sqlc "bungleware/vault/internal/db/sqlc"
)

func TestDeleteFolderIfEmpty(t *testing.T) {
	database, err := New(Config{DataDir: t.TempDir(), DBFile: "test.db", MigrationsPath: "../../migrations"})
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	ctx := context.Background()
	user, err := database.CreateUser(ctx, sqlc.CreateUserParams{Username: "artist", PasswordHash: "unused"})
	if err != nil {
		t.Fatal(err)
	}
	folder, err := database.CreateFolder(ctx, sqlc.CreateFolderParams{UserID: user.ID, Name: "Keep until empty"})
	if err != nil {
		t.Fatal(err)
	}
	if deleted, err := database.DeleteFolderIfEmpty(ctx, folder.ID, user.ID+1); err != nil || deleted {
		t.Fatalf("another user's folder deleted: %v", err)
	}
	_, err = database.Exec("INSERT INTO projects (user_id, name, public_id, folder_id) VALUES (?, 'Song', 'project-1', ?)", user.ID, folder.ID)
	if err != nil {
		t.Fatal(err)
	}
	if deleted, err := database.DeleteFolderIfEmpty(ctx, folder.ID, user.ID); err != nil || deleted {
		t.Fatalf("nonempty folder deleted: %v", err)
	}
	if _, err := database.Exec("UPDATE projects SET folder_id = NULL WHERE public_id = 'project-1'"); err != nil {
		t.Fatal(err)
	}
	if deleted, err := database.DeleteFolderIfEmpty(ctx, folder.ID, user.ID); err != nil || !deleted {
		t.Fatalf("empty folder wasn't deleted: %v", err)
	}
	if deleted, err := database.DeleteFolderIfEmpty(ctx, folder.ID, user.ID); err != nil || deleted {
		t.Fatalf("missing folder reported as deleted: %v", err)
	}
}
