# Export And Music Library

Open a project's menu and choose **Export & Library**.

- **Library Ready (Tagged)** exports the album as FLAC or MP3 with full tags, track numbers, and the project cover embedded in every file, plus `cover.png`. Download it as a ZIP, or publish it to a server folder that your music player scans.
- **Raw Masters** downloads the original uploaded files, byte for byte, as one ZIP or per track.

Your stored masters are never modified. Lossless sources (WAV, AIFF, ALAC, FLAC) become FLAC by default; 32-bit float WAV stays float WAV so no precision is lost. Lossy sources never offer FLAC (that would only bloat the file). Existing MP3 audio is not re-encoded, and AAC is repackaged as M4A without re-encoding. Choose MP3 for a 320 kbps copy of everything else. Every conversion is disclosed in the modal before you download or publish.

Publishing writes to `Vault-<owner ID>-<project ID>` inside the folder you configure, replaces it atomically, and refuses to overwrite folders or files it does not own or that were edited outside { vault.studio }. Publishing is off until an administrator mounts a library folder; see [audio-metadata.md](audio-metadata.md) for setup and details.

[Back to the README](../README.md)
