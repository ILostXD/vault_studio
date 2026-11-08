# Self-hosting Guide

## Updating

```bash
git pull --ff-only
docker compose up -d --build
```

## In-app Updates

Admins can check GitHub Releases from **Settings > Instance Information**. { vault.studio }'s GitHub Actions workflow builds the server and audio-analysis Docker images and publishes them to this repository's GitHub Container Registry (GHCR) packages whenever a version tag such as `v1.1.0` is pushed. Docker Hub is not required.

The updater does not run `git pull`, build the newest `main` commit, or publish images itself. It only pulls the `latest` images produced by a tagged GitHub release. Before enabling it, make both GHCR packages public:

- `ghcr.io/ilostxd/vault_studio`
- `ghcr.io/ilostxd/vault_studio-audio-analysis`

Then start { vault.studio } once with the isolated updater override to enable the **Update** button:

```bash
docker compose -f docker-compose.yml -f docker-compose.updates.yml up -d --build
```

After that one-time setup, each future tagged release can be installed from Settings without running Git or Compose commands again. The updater pulls the published GHCR images, preserves the existing `./data` mount, and restarts the { vault.studio } services. It is not exposed on a host port, uses the instance JWT secret for its internal request, and only its dedicated Watchtower container receives the Docker socket. Keep `JWT_SECRET` private. Android APK updates remain handled by Obtainium or the GitHub release page.

## Configuration

| Variable | Description | Default |
| --- | --- | --- |
| `JWT_SECRET` | Secret used to sign access tokens | Required |
| `SIGNED_URL_SECRET` | Secret used to sign media URLs | Required |
| `TOKEN_PEPPER` | Pepper used when hashing tokens | Required |
| `HOST_PORT` | Port exposed on the host | `8080` |
| `ACCESS_TOKEN_TTL` | Access-token lifetime | `15m` |
| `REFRESH_TOKEN_TTL` | Refresh-token lifetime | `720h` |
| `SIGNED_URL_TTL` | Signed media URL lifetime | `5m` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated additional frontend origins | Local defaults |
| `LOG_LEVEL` | Log verbosity (`debug`, `info`, `warn`, `error`) | `warn` |
| `TOOLOST_CLIENT_ID` | Too Lost OAuth application client ID | Optional |
| `TOOLOST_CLIENT_SECRET` | Too Lost OAuth application client secret | Optional |
| `TOOLOST_ENVIRONMENT` | Too Lost API environment (`sandbox` or `production`) | `sandbox` |
| `PUBLIC_BASE_URL` | Public HTTPS instance URL used for OAuth callbacks | Required for Too Lost |
| `PROVIDER_TOKEN_ENCRYPTION_KEY` | Advanced override: base64-encoded 32-byte key for provider credentials | Derived from `JWT_SECRET` |
| `MUSIC_LIBRARY_DIR` | Writable folder for publishing tagged albums to a music library (Docker: set `MUSIC_LIBRARY_HOST_DIR` and use `docker-compose.music-library.yml`) | Disabled |

[Back to the README](../README.md)
