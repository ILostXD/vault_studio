package audiometadata

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	"image/png"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"bungleware/vault/internal/fileutil"
	"go.senan.xyz/taglib"
	_ "golang.org/x/image/webp"
)

// Export owns a disposable copy, never a Vault source or a hardlink to one.
type Export struct {
	Path     string
	Filename string
	Track    Track
	dir      string
}

func (e *Export) Cleanup() { _ = os.RemoveAll(e.dir) }

func (s *Service) BuildTrack(ctx context.Context, userID, projectID, trackID, versionID int64) (_ *Export, err error) {
	select {
	case s.exports <- struct{}{}:
		defer func() { <-s.exports }()
	default:
		return nil, ErrBusy
	}
	state, err := s.Resolve(ctx, userID, projectID)
	if err != nil {
		return nil, err
	}
	var selected *Track
	for i := range state.Tracks {
		if state.Tracks[i].TrackID == trackID {
			selected = &state.Tracks[i]
			break
		}
	}
	if selected == nil {
		return nil, sql.ErrNoRows
	}
	// Pin downloads to the previewed version; changing Primary Version must not silently
	// download a different master. Explicit older-version publishing can be added later.
	if versionID <= 0 || selected.VersionID != versionID {
		return nil, fmt.Errorf("%w: the primary version changed; refresh the preview", ErrInvalid)
	}
	if selected.sourcePath == "" {
		return nil, ErrUnavailable
	}
	if !selected.CanDownload {
		return nil, ErrUnavailable
	}
	tags := map[string][]string{
		taglib.Title: {selected.Title}, taglib.Artist: {selected.Artist}, taglib.Album: {selected.Album},
		taglib.AlbumArtist: {selected.AlbumArtist}, taglib.Genre: {selected.Genre},
		taglib.Date: {selected.Year}, taglib.TrackNumber: {strconv.Itoa(selected.Number)},
	}
	for key, values := range tags {
		if !validText(values[0]) {
			return nil, fmt.Errorf("%w: invalid %s", ErrInvalid, key)
		}
		if values[0] == "" {
			tags[key] = nil
		}
	}
	source, err := s.openAsset(selected.sourcePath)
	if err != nil {
		return nil, err
	}
	defer source.Close()
	dir, err := os.MkdirTemp("", "vault-tagged-audio-")
	if err != nil {
		return nil, err
	}
	result := &Export{dir: dir, Track: *selected}
	defer func() {
		if err != nil {
			result.Cleanup()
		}
	}()
	ext := selected.Format
	if ext == "alac" {
		ext = "m4a"
	}
	result.Path = filepath.Join(dir, "tagged."+ext)
	result.Filename = fmt.Sprintf("%02d - %s.%s", selected.Number, fileutil.SanitizeFilename(selected.Title), ext)
	copyPath := result.Path
	if selected.Conversion != "" {
		copyPath = filepath.Join(dir, "source")
	}
	dest, err := os.OpenFile(copyPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return nil, err
	}
	_, copyErr := io.Copy(dest, contextReader{ctx: ctx, reader: source})
	closeErr := dest.Close()
	if copyErr != nil {
		return nil, copyErr
	}
	if closeErr != nil {
		return nil, closeErr
	}
	if err = ctx.Err(); err != nil {
		return nil, err
	}
	if selected.Conversion != "" {
		conversionCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
		defer cancel()
		// Only the staged file is opened by FFmpeg. Restrict protocols and select audio
		// explicitly; retain source channels/rate, never copy a video stream.
		args := []string{"-nostdin", "-v", "error", "-n",
			"-protocol_whitelist", "file", "-format_whitelist", audioDemuxers, "-i", copyPath, "-map", "0:a:0", "-map_metadata", "-1",
			"-vn", "-threads", "1"}
		switch selected.Format {
		case "m4a":
			args = append(args, "-c:a", "copy")
		case "mp3":
			args = append(args, "-c:a", "libmp3lame", "-q:a", "2")
		case "wav":
			args = append(args, "-c:a", "pcm_f64le")
		default:
			args = append(args, "-c:a", "flac")
		}
		cmd := exec.CommandContext(conversionCtx, "ffmpeg", append(args, result.Path)...)
		if output, conversionErr := cmd.CombinedOutput(); conversionErr != nil {
			return nil, fmt.Errorf("audio conversion failed: %w: %.1024s", conversionErr, output)
		}
	}
	if err = taglib.WriteTags(result.Path, tags, 0); err != nil {
		return nil, fmt.Errorf("write audio tags: %w", err)
	}
	// Verify the container accepted every requested field, including cleared values.
	written, err := taglib.ReadTags(result.Path)
	if err != nil {
		return nil, err
	}
	for key, values := range tags {
		if strings.Join(written[key], "\x00") != strings.Join(values, "\x00") {
			return nil, fmt.Errorf("%w: container did not preserve %s", ErrUnsupported, key)
		}
	}
	properties, err := taglib.ReadProperties(result.Path)
	if err != nil {
		return nil, err
	}
	if len(properties.Images) > 32 {
		return nil, fmt.Errorf("%w: too many embedded pictures", ErrUnsupported)
	}
	// Remove stale source pictures so the resolved project cover is authoritative.
	for i := len(properties.Images) - 1; i >= 0; i-- {
		if err = ctx.Err(); err != nil {
			return nil, err
		}
		if err = taglib.WriteImageOptions(result.Path, nil, i, "Front Cover", "", ""); err != nil {
			return nil, err
		}
	}
	if selected.Artwork {
		cover, coverErr := s.coverPNG(ctx, selected.coverPath)
		if coverErr != nil {
			return nil, coverErr
		}
		if err = taglib.WriteImageOptions(result.Path, cover, 0, "Front Cover", "", "image/png"); err != nil {
			return nil, fmt.Errorf("embed project cover: %w", err)
		}
		actual, readErr := taglib.ReadImage(result.Path)
		if readErr != nil || !bytes.Equal(actual, cover) {
			return nil, fmt.Errorf("%w: container did not preserve the cover", ErrUnsupported)
		}
	}
	if err = ctx.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

const audioDemuxers = "aac,mp3,flac,wav,aiff,mov,asf,ogg,matroska,webm,avi,ape,wv,tta"

func (s *Service) conversionPlan(ctx context.Context, format, path string) (string, string, error) {
	if format == "aac" {
		return "m4a", "AAC will be repackaged as M4A for album tags and artwork, without re-encoding or increasing audio quality. File size stays similar.", nil
	}
	file, err := s.openAsset(path)
	if err != nil {
		return "", "", err
	}
	defer file.Close()
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "ffprobe", "-v", "error", "-protocol_whitelist", "pipe", "-format_whitelist", audioDemuxers, "-select_streams", "a:0", "-show_entries", "stream=codec_name", "-of", "json", "-i", "pipe:0")
	cmd.Stdin = file
	output, err := cmd.Output()
	if err != nil {
		return "", "", err
	}
	var probe struct {
		Streams []struct {
			Codec string `json:"codec_name"`
		} `json:"streams"`
	}
	if err = json.Unmarshal(output, &probe); err != nil || len(probe.Streams) == 0 {
		return "", "", ErrUnsupported
	}
	codec := probe.Streams[0].Codec
	if strings.HasPrefix(codec, "pcm_f") {
		return "wav", "Floating-point audio will use a tagged floating-point WAV copy because FLAC cannot preserve floating-point samples.", nil
	}
	if strings.HasPrefix(codec, "pcm_") || codec == "flac" || codec == "alac" || codec == "ape" || codec == "wavpack" || codec == "tta" {
		return "flac", "This lossless source will be converted to FLAC for supported album tags and embedded artwork.", nil
	}
	if codec == "aac" {
		return "m4a", "AAC audio will be repackaged as M4A for album tags and artwork without re-encoding.", nil
	}
	return "mp3", "This lossy source will be converted to a high-quality VBR MP3 for album tags and artwork. Re-encoding can lose quality; file size varies.", nil
}

// OpenRoot confines reads (including symlinks) to Vault storage; clients never supply paths.
func (s *Service) openAsset(path string) (*os.File, error) {
	rootPath, err := filepath.Abs(s.root)
	if err != nil {
		return nil, ErrUnavailable
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, ErrUnavailable
	}
	relative, err := filepath.Rel(rootPath, absolute)
	if err != nil || !filepath.IsLocal(relative) {
		return nil, ErrUnavailable
	}
	root, err := os.OpenRoot(rootPath)
	if err != nil {
		return nil, ErrUnavailable
	}
	defer root.Close()
	file, err := root.Open(relative)
	if err != nil {
		return nil, ErrUnavailable
	}
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		file.Close()
		return nil, ErrUnavailable
	}
	return file, nil
}

func (s *Service) coverPNG(ctx context.Context, path string) ([]byte, error) {
	file, err := s.openAsset(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(contextReader{ctx: ctx, reader: file}, (20<<20)+1))
	if err != nil {
		return nil, err
	}
	if len(data) > 20<<20 {
		return nil, fmt.Errorf("%w: cover exceeds 20 MB", ErrInvalid)
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 || int64(config.Width)*int64(config.Height) > 25_000_000 {
		return nil, fmt.Errorf("%w: cover must be a valid image up to 25 megapixels", ErrInvalid)
	}
	decoded, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	var output bytes.Buffer
	if err = png.Encode(&output, decoded); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}

type contextReader struct {
	ctx    context.Context
	reader io.Reader
}

func (r contextReader) Read(p []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	return r.reader.Read(p)
}
