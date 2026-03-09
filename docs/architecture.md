# Architecture

CyberLens has three runtime services plus Redis and SQLite.

## Backend

- Django serves auth, settings, monitoring, scan orchestration, and result APIs.
- Celery runs monitoring collection jobs and repository scan jobs.
- SQLite stores scan results, incidents, traces, settings, and dashboard data.

## Frontend

- React 18 + Vite powers the dashboard.
- The UI is split by feature:
  - `auth`
  - `monitor`
  - `settings`
  - `supply-chain`
- Shared API helpers and type re-exports live under `frontend/src/shared` and `frontend/src/types`.

## Realtime

- A Node.js Socket.IO bridge subscribes to Redis pub/sub channels.
- The browser receives:
  - scan progress
  - ADK trace events
  - incident updates
  - estate snapshots

## Monitoring Flow

```text
GCP Logs / Metrics
  -> monitor services
  -> Django models + cache
  -> Redis publisher
  -> realtime bridge
  -> React Live Monitor
```

## Supply Chain Flow

```text
GitHub repo or local path
  -> scanner endpoints
  -> dependency scan + code scan pipeline
  -> SQLite models + Redis stream
  -> React Supply Chain view
```

## Main Directories

- `backend/accounts`: auth and per-user settings
- `backend/monitor`: monitoring models, APIs, and collectors
- `backend/scanner`: scan models, APIs, and analysis services
- `frontend/src/app`: routing and dashboard shell
- `frontend/src/features`: feature-oriented UI modules
- `realtime/src`: socket bridge and event contracts
