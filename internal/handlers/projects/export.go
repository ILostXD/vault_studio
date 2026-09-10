package projects

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type projectExportFile struct {
	path string
	name string
}

func buildProjectExport(ctx context.Context, files []projectExportFile, progress func(int64, int64, string)) (archive *os.File, err error) {
	var total, loaded int64
	infos := make([]os.FileInfo, len(files))
	for i, file := range files {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		info, err := os.Stat(file.path)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", file.name, err)
		}
		if !info.Mode().IsRegular() {
			return nil, fmt.Errorf("%s is not a regular file", file.name)
		}
		infos[i] = info
		total += info.Size()
	}
	archive, err = os.CreateTemp("", "vault-project-export-*.zip")
	if err != nil {
		return nil, err
	}
	defer func(file *os.File) {
		if err != nil {
			file.Close()
			os.Remove(file.Name())
		}
	}(archive)

	zw := zip.NewWriter(archive)
	defer zw.Close()
	for i, file := range files {
		progress(loaded, total, file.name)
		if err = writeProjectExportFile(ctx, zw, file, infos[i], func(n int) {
			loaded += int64(n)
			progress(loaded, total, file.name)
		}); err != nil {
			return nil, fmt.Errorf("%s: %w", file.name, err)
		}
	}
	if err = zw.Close(); err != nil {
		return nil, err
	}
	if _, err = archive.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	return archive, nil
}

func writeProjectExportFile(ctx context.Context, zw *zip.Writer, file projectExportFile, info os.FileInfo, progress func(int)) error {
	source, err := os.Open(file.path)
	if err != nil {
		return err
	}
	defer source.Close()
	header, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}
	header.Name = file.name
	ext := strings.ToLower(filepath.Ext(file.name))
	switch ext {
	case ".mp3", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov":
		header.Method = zip.Store
	default:
		header.Method = zip.Deflate
	}
	writer, err := zw.CreateHeader(header)
	if err != nil {
		return err
	}
	n, err := io.Copy(writer, &exportReader{ctx: ctx, reader: io.LimitReader(source, info.Size()), progress: progress})
	if err == nil && n != info.Size() {
		err = io.ErrUnexpectedEOF
	}
	return err
}

type exportReader struct {
	ctx      context.Context
	reader   io.Reader
	progress func(int)
}

func (r *exportReader) Read(p []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	n, err := r.reader.Read(p)
	if n > 0 {
		r.progress(n)
	}
	return n, err
}
