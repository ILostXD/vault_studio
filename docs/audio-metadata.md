# Export & Library

Open a project's menu and choose **Export & Library**.

This unified export view offers two distinct modes:

1. **Library Ready (Tagged)**: Fully tagged audio files (Vorbis / ID3 / MP4 atoms with Title, Artist, Album, Album Artist, Genre, Date/Year, Track Number, and embedded Front Cover artwork, plus `cover.png`), ready for music libraries (Navidrome, Jellyfin, Plex, Navic) or tagged album ZIP downloads.
2. **Raw Masters**: Untouched original master files exactly as exported from your DAW and uploaded to Vault Studio (original formats e.g. WAV/AIFF, original bit depth, no injected tags or transcoding), available as full raw album ZIPs or individual raw track downloads.

## Smart Format Conversion

Vault preserves your original master files at all times. For library-ready exports:

- **Lossless sources (WAV, FLAC, AIFF, ALAC)**:
  - **FLAC (Lossless)** [Default]: Integer 16/24-bit WAV, AIFF and ALAC sources are converted to FLAC with tags and artwork. Floating-point and higher-precision sources retain their sample precision through a floating-point WAV derivative instead; player support for WAV artwork varies. Check the per-track format notice.
  - **MP3 (320 kbps)**: Re-encodes audio at 320 kbps for compatibility. Existing MP3 audio is retained without another lossy encoding pass, so its original bitrate is unchanged. File size depends on the source; re-encoding can reduce quality.
- **Lossy sources (MP3, AAC/M4A, OGG, Opus)**:
  - Upconverting lossy audio to FLAC does not restore lost audio frequencies and only bloats file sizes. Therefore, lossy source projects only offer lossy export options (original lossy format or MP3).
  - Raw AAC is repackaged into an M4A container without re-encoding to support metadata and cover art.

Conversion notices appear before download or publication so you always know what format each track will be exported to and why.

## Connect A Server Music Library

This publishes ordinary tagged audio files to a server folder, not to an Apple
Music or Spotify account. Navidrome, Jellyfin, or another local-library player can
scan that folder using its normal library settings.

For Docker, create a writable library folder on the host, then set this in `.env`:

```dotenv
MUSIC_LIBRARY_HOST_DIR=/absolute/path/to/Music
```

On Windows use a path such as `C:/Users/andyh/Music/Vault`. Mount it with:

```sh
docker compose -f docker-compose.yml -f docker-compose.music-library.yml up -d --build
```

Use both Compose files on later rebuilds too. For a non-Docker server, set
`MUSIC_LIBRARY_DIR` to an existing writable directory before starting Vault.
The app cannot create a host mount; that one-time administrator step is required.
Do not point this setting at Vault's internal data directory or source folders.
Leave it unset to disable publishing without disabling album downloads.

## Publish And Update

Choose **Add to music library**. Vault prepares the entire album before making it
visible in a stable `Vault-<owner ID>-<project ID>` folder. Files have numbered song
names and full album tags; the stable folder name prevents collisions and duplicate
albums after renaming. A hidden manifest records versions, metadata, checksums and
publication time. The UI shows whether the last published snapshot matches Vault.
After changing tags, track order or primary versions, choose **Update music library**.
Trigger a library scan in your music player if it does not watch for changes.

Only project owners can publish. Requests cannot choose arbitrary destination
paths. Existing unrecognized folders, symlinks, added files or externally edited
published files are not overwritten. Move such a folder aside before republishing.
Keep the library folder and its manifest under trusted administrator control.
Use a single Vault server instance for a shared publishing folder.

Preparation uses disk-backed temporary copies and may take time for a large album.
The app distinguishes preparation from download; percentage during transfer is
based on actual bytes, not a simulated preparation estimate. Keep the modal open
until it finishes. No automatic external-player rescan is performed.

If the server stops between the two publication renames, the next publish restores
the previous folder when the destination is absent. If both the destination and a
hidden `-previous` backup exist, an administrator must inspect and move the backup
aside before publishing again. Originals inside Vault are never affected.
