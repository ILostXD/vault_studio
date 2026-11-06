# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`{ vault.studio }` — a self-hosted, open-source (AGPL-3.0) music work-in-progress streaming/organizing app, forked from [bungleware/vault](https://github.com/bungleware/vault) (upstream is inactive). Adds a Capacitor Android app, BPM/key analysis, rich notes, voice memos, motion artwork, release preparation/distribution (Too Lost), and audio-metadata tagging/export. Go backend + SQLite, React frontend, Python analysis sidecar.

## Commands

Requires Go 1.25+ (CGO enabled, SQLite) and Bun (`frontend/` has both `bun.lock` and `package-lock.json`; Docker uses bun). Copy `.env.example` to `.env` and set `JWT_SECRET`, `SIGNED_URL_SECRET`, `TOKEN_PEPPER`; set `AUDIO_ANALYSIS_URL=disabled` when running without the sidecar.

```bash
make dev                # wgo live-reload backend (:8080) + vite dev server (:3000, proxies /api incl. ws)
make build              # frontend build -> go build -o server cmd/server/main.go
sqlc generate           # after editing internal/db/queries/*.sql or migrations/
docker compose up -d --build   # full stack: server + audio-analysis (+ optional updater/music-library overlays)

go test ./...                                   # backend
go test ./internal/audiometadata -run TestName  # single Go test
cd frontend && bun run test                     # vitest (jsdom)
cd frontend && bunx vitest run src/components/MusicPlayer.test.tsx   # single frontend test
cd frontend && bun run check                    # biome (lint+format); `build` also runs tsc
```

Android (Capacitor, `frontend/android`): `bun run mobile:sync:android` builds the web app and syncs it, then build/install via Gradle. Two product flavors: `production` (`com.vaultstudio.app`) and `dev` (`com.vaultstudio.app.dev`, "-dev" suffix, separate icon, `versionCode` set in `frontend/android/app/build.gradle`). Use the `dev` flavor (`installDevDebug`) when testing so it doesn't replace the real app. The WebView is served from `http://localhost` and the backend URL is user-selectable at runtime (`frontend/src/api/server.ts`).

## Architecture

**Backend (`cmd/server/main.go` → `internal/`)**: `main.go` wires everything — config/env, DB open + migrations (`./migrations`, plain numbered `.sql`, applied at startup), `service.Container`, handlers, middleware, and serves the built SPA from `./frontend/dist` alongside `/api`. Layers: `handlers/*` (HTTP, grouped by domain; sub-packages `projects`, `tracks`, `sharing`, `shared`) → `service/*` (business logic; images, motion art, audio analysis client, auth) → `db` (sqlc-generated code in `internal/db/sqlc` from `internal/db/queries/*.sql`; **never hand-edit generated files**). Other packages: `middleware` (auth, CSRF, signed media URLs), `storage`, `transcoding` (FFmpeg), `audiometadata` (project-scoped tag resolver, album/library handling, tagged export), `distribution` (release prep, Too Lost OAuth/drafts), `integrations` (encrypted provider secrets keyed off `JWT_SECRET`). Media is accessed through short-lived signed URLs rather than cookies alone.

**Audio analysis**: `audio-analysis/app.py` is a separate container the Go server calls over HTTP (`AUDIO_ANALYSIS_URL`) for BPM/key. `cmd/clear-*`, `cmd/generate-waveforms` are maintenance tools.

**Frontend (`frontend/src`)**: Vite + React 19 + TanStack Router (file-based; `routeTree.gen.ts` is generated) + TanStack Query + Tailwind v4 + Radix. `api/*` is the per-domain fetch layer built on `api/client.ts` (token refresh, server URL resolution — also what makes the Capacitor build work against a remote backend). `contexts/` holds auth, preferences, export, and the audio player (`AudioPlayerContext`/`PlaybackProgressContext`); playback UI is `MusicPlayer`, `NowPlayingView`, `QueuePanel`, and native Android media session via the Kotlin plugins in `frontend/android/app/src/main/java/com/vaultstudio/app/`. Mobile and desktop share components with responsive/gesture-aware layouts, so changes to player/modal components need checking at both sizes.

**Schema changes** = new `migrations/NNN_*.sql` (next is 042) + query edits + `sqlc generate`; sqlc reads the migrations directly as its schema.

## Gotchas

- Windows dev PC: gcc (WinLibs), Bun, Go, Docker and the Android SDK are installed, but `bunx` isn't on PATH (use `bun x`) and `adb` isn't either (`$ANDROID_HOME/platform-tools`). Run Go tests with `CGO_ENABLED=1`.
- Android build: Gradle needs JDK 21+, but PATH has JDK 17. Set `JAVA_HOME` to `C:\Program Files\Android\Android Studio\jbr`, then `bun x cap sync android` and `cd frontend/android && ./gradlew.bat installDevDebug`.
- Wireless debugging: `adb connect <ip:port>` (the port changes per pairing session). `INSTALL_FAILED_UPDATE_INCOMPATIBLE` means the installed app has a different debug keystore, so `adb uninstall` it first (wipes app data).

- `.gitattributes` forces LF. Windows editors/tools can still leave CRLF in the working tree; check with `git ls-files --eol | grep -E "w/(crlf|mixed)"` and strip with `sed -i 's/\r$//'`.
- `ffmpeg`/`ffprobe` are not installed on the Windows host, so FFmpeg-dependent Go tests (most of `internal/audiometadata`: tagged export, album ZIP, library publish) **silently skip** with a native `go test`. Run them in Linux: `docker run --rm -e CGO_ENABLED=1 -v "$(pwd -W):/src" -w /src golang:1.25-bookworm bash -c "apt-get update -qq && apt-get install -y -qq ffmpeg && go test ./..."` (set `MSYS_NO_PATHCONV=1` in Git Bash).
- `bun run check` (biome) is scoped to app source; it excludes `frontend/android/**` (which contains a copy of the built bundle). It still reports ~550 real lint and ~170 formatting findings that predate this work.
- `graphify-out/`, `frontend/src/graphify-out/`, `scratch/`, `.codex-remote-attachments/` are tooling/scratch output, not product code.
- Release flow: pushing a `v*` tag triggers `.github/workflows/docker-build.yml`, which publishes server + analysis images to GHCR (used by the in-app updater).
- See `docs/DEVELOPMENT.md`, `docs/audio-metadata.md`, and `CONTRIBUTING.md` (AI-assisted contributions policy) for more.
