# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CyberLens is a full-stack security dashboard with three services:
- **backend/** — Django 5.1 REST API (Python 3.12) with Celery workers
- **frontend/** — React 18 SPA (TypeScript, Vite)
- **realtime/** — Node.js Socket.IO server bridging Redis pub/sub to WebSocket clients

Infrastructure: PostgreSQL, Redis, Nginx (JSON access log format for monitoring).

## Commands

### Run the full stack
```bash
docker compose up --build
```
Services: backend (:8000), frontend (:5173), realtime (:3001), PostgreSQL (:5432), Redis (:6379)

### Backend (Django)
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000

# Celery worker (separate terminal)
celery -A cyberlens worker -l INFO

# Log watcher (monitors Nginx JSON logs)
python manage.py watch_logs
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build
```

### Realtime
```bash
cd realtime
npm install
npm run dev        # nodemon + ts-node
npm run build      # tsc
npm start          # node dist/index.js
```

### Tests
```bash
# Backend (pytest)
cd backend
pytest                          # all tests
pytest monitor/tests/           # monitor app tests
pytest scanner/tests/           # scanner app tests
pytest scanner/tests/test_views.py  # single test file
pytest -k test_scan_detail      # single test by name

# Frontend (vitest + type check)
cd frontend
npm test                        # vitest run (all tests)
npx tsc -b                      # type check only (no emit)
```
Backend config: `pytest.ini` sets `DJANGO_SETTINGS_MODULE=cyberlens.settings`, strict markers, verbose output, short traceback.

Fixtures in `conftest.py`: factories for all models (`scan_factory`, `dependency_factory`, `vulnerability_factory`, `http_request_factory`, `gcp_service_factory`, `gcp_event_factory`, `gcp_incident_factory`, etc.), `mock_redis`, auto-use `_use_locmem_cache`.

### CI
GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main`:
- **Backend Tests**: Python 3.12, pytest with Redis service (SQLite for CI)
- **Frontend Checks**: Node 20, `tsc -b` type check + `npm test` (vitest)

## Architecture

### Data Flow
```
Nginx logs → LogWatcher (Watchdog) → batch HttpRequests → Celery analyze_batch → AI threat analysis
                                                                    ↓
Frontend ←── Socket.IO ←── Realtime ←── Redis pub/sub ←── Backend publishes events
    |                                                          ↑
    └── REST API calls (/api/*) ──────────────────────────────┘
```

### Backend Apps

**`monitor/`** — Real-time HTTP request monitoring + GCP Security SOC
- Legacy models: `HttpRequest` → `AnalysisResult` (1:1) → `Alert` (1:N)
- GCP models: `GcpObservedService`, `GcpSecurityEvent` → `GcpSecurityIncident`, `GcpServiceHealth`
- `services/log_watcher.py`: Watchdog-based Nginx log monitor, batches 15 requests or 5s timeout
- `services/ai_analyzer.py`: Celery task `analyze_batch` — uses Google ADK (Gemini 2.5 Flash) with Pydantic schemas for structured output
- `services/gcp_aggregator.py`: Celery tasks for GCP polling — `gcp_fetch_logs`, `gcp_fetch_metrics`, `gcp_discover_services`, `gcp_fetch_timeseries`
- `services/gcp_log_fetcher.py`: Multi-source GCP log fetcher (Cloud Run, Load Balancer, Cloud Armor, IAM Audit, IAP)
- `services/gcp_event_parser.py`: Normalises raw logs into `GcpSecurityEvent` dicts with pattern-based attack classification
- `services/gcp_rule_engine.py`: Incident clustering from event streams with configurable thresholds and auto-merge
- `services/gcp_metrics_fetcher.py`: Cloud Monitoring API metrics (request count, latency, CPU, memory, instance count)
- `services/gcp_discovery.py`: Cloud Run service/revision auto-discovery via Admin API v2
- `services/redis_publisher.py`: Publishes to channels `cyberlens:{new_request,alert,stats_update,scan_progress,scan_complete,gcp_estate_snapshot,gcp_security_event,gcp_incident_update,gcp_service_health,gcp_timeseries_update}`
- GCP REST endpoints: `/api/gcp-estate/{summary,services,timeseries,refresh}`, `/api/gcp-security/{events,incidents,incidents/:id,incidents/:id/ack,map}`

**`scanner/`** — Dependency vulnerability + code security scanning
- Models: `GitHubScan` → `Dependency` → `Vulnerability`, plus `AiReport` (1:1) and `CodeFinding` (1:N)
- ADK pipeline models: `AdkTraceEvent`, `CodeScanFileIndex`, `CodeScanChunk`, `CodeScanCandidate`
- Supports GitHub repos (via PAT in Django session) and local directories (validated against `LOCAL_SCAN_ROOT`)
- `services/dependency_parser.py`: Parses package.json, requirements.txt, pyproject.toml, go.mod, Gemfile
- `services/osv_scanner.py`: Celery tasks `run_full_scan` / `run_local_scan` — queries OSV API, creates records, triggers AI report + code scan
- `services/ai_reporter.py`: Generates security scores and remediation via Gemini
- `services/adk_code_pipeline.py`: Multi-stage AI code analysis — inventory → chunking → summarization → 7 risk passes → candidate generation → evidence expansion → verification → repo synthesis
- `services/code_scanner.py`: AI-powered source code security analysis
- `services/github_client.py` / `local_client.py`: File fetching with extension filtering, size limits (50KB), skip dirs (node_modules, .git, etc.)

**`accounts/`** — User auth and per-user settings
- `UserSettings` (1:1 with User): google_api_key, github_pat, gemini_model, GCP config fields
- `GeminiLog`: Audit trail for all Gemini API calls (tokens, duration, status)

**`cyberlens/`** — Django project config
- `urls.py`: `/api/` → monitor, `/api/github/` → scanner, `/api/settings/` → API key management
- `celery.py`: Celery app with Redis broker
- `utils.py`: `get_google_api_key()` (Redis-cached), `clean_json_response()` (strips markdown from LLM output), `log_gemini_call()` audit logging

### Frontend Structure

- `App.tsx`: Three-tab layout — Live Monitor, Code Scan, Settings
- `services/api.ts`: REST client with dual-backend support (local + optional remote Cloud Run), auto CSRF token injection
- `hooks/useSocket.ts`: Socket.IO hook for real-time events (listens to 12 Redis channels)
- `theme/theme.ts`: Material You (M3) design tokens + `socColors` dark SOC theme tokens
- `types/index.ts`: All TypeScript interfaces (auth, monitor, scanner, GCP types)
- `pages/LiveMonitorPage.tsx`: GCP Security SOC dashboard — dark-theme war room with estate matrix, threat timeline, perimeter lanes, geo attack map, evidence feed, incident queue, triage drawer
- `pages/SupplyChainPage.tsx`: D3 dependency tree + vulnerability list + AI remediation report + code findings + ADK pipeline trace
- `pages/SettingsPage.tsx`: Cloud Run URL, API key, GitHub PAT, project selection

### Realtime Service

- `src/index.ts`: Express + Socket.IO server with session-based auth (verifies via backend `/api/verify-session/`)
- `src/redis-subscriber.ts`: Subscribes to 12 Redis `cyberlens:*` channels, broadcasts parsed JSON to all Socket.IO clients

### Key Environment Variables (see .env.example)
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `GOOGLE_API_KEY` — Gemini API key (also settable via UI, cached in Redis)
- `LOCAL_SCAN_ROOT` — Base directory for local project scanning (maps to `/scan-targets` in container)
- `NGINX_LOG_PATH` — Path to Nginx JSON access log for monitoring

### Conventions
- Backend uses Django REST Framework serializers for all API responses
- AI integrations use Google ADK `InMemoryRunner` with Pydantic models for structured output
- All real-time communication flows through Redis pub/sub → Socket.IO (never direct backend→frontend WebSocket)
- Frontend uses inline styles with CSS custom properties from theme; no CSS framework
- GitHub PATs are stored in Django sessions, not environment variables
- Celery runs in eager mode during dev/test (tasks execute synchronously)
- Frontend dev proxy: `/api` → `http://localhost:8000` (change to `localhost` when running outside Docker)
- Frontend tests use vitest + jsdom + React Testing Library; socket.io-client is globally mocked in test setup
- All Gemini API calls are audited to the `GeminiLog` table with token counts and duration
