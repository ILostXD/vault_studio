package handlers

import (
	"context"
	"net/http/httptest"
	"strconv"
	"testing"

	"bungleware/vault/internal/db"
	sqlc "bungleware/vault/internal/db/sqlc"
	"bungleware/vault/internal/middleware"
)

func TestBrowsingDoesNotDeleteEmptyFolders(t *testing.T) {
	database, err := db.New(db.Config{DataDir: t.TempDir(), DBFile: "test.db", MigrationsPath: "../../migrations"})
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	ctx := context.Background()
	user, err := database.CreateUser(ctx, sqlc.CreateUserParams{Username: "artist", PasswordHash: "unused"})
	if err != nil {
		t.Fatal(err)
	}
	folder, err := database.CreateFolder(ctx, sqlc.CreateFolderParams{UserID: user.ID, Name: "New album"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec("UPDATE folders SET created_at = '2020-01-01' WHERE id = ?", folder.ID); err != nil {
		t.Fatal(err)
	}
	h := NewFoldersHandler(database)
	r := httptest.NewRequest("GET", "/api/folders", nil)
	r = r.WithContext(context.WithValue(ctx, middleware.UserIDKey, int(user.ID)))
	r.SetPathValue("id", strconv.FormatInt(folder.ID, 10))
	if err := h.ListFolders(httptest.NewRecorder(), r); err != nil {
		t.Fatal(err)
	}
	if err := h.ListAllFolders(httptest.NewRecorder(), r); err != nil {
		t.Fatal(err)
	}
	if err := h.GetFolderContents(httptest.NewRecorder(), r); err != nil {
		t.Fatal(err)
	}
	if _, err := database.GetFolder(ctx, sqlc.GetFolderParams{ID: folder.ID, UserID: user.ID}); err != nil {
		t.Fatalf("browsing deleted an empty folder: %v", err)
	}
}
