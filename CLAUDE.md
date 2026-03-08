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

### Tests (backend only)
```bash
cd backend
pytest                          # all tests
pytest monitor/tests/           # monitor app tests
pytest scanner/tests/           # scanner app tests
pytest scanner/tests/test_views.py  # single test file
pytest -k test_scan_detail      # single test by name
```
Config: `pytest.ini` sets `DJANGO_SETTINGS_MODULE=cyberlens.settings`, strict markers, verbose output, short traceback.

Fixtures in `conftest.py`: factories for all models (`scan_factory`, `dependency_factory`, `vulnerability_factory`, `http_request_factory`, etc.), `mock_redis`, auto-use `_use_locmem_cache`.

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

**`monitor/`** — Real-time HTTP request monitoring
- Models: `HttpRequest` → `AnalysisResult` (1:1) → `Alert` (1:N)
- `services/log_watcher.py`: Watchdog-based Nginx log monitor, batches 15 requests or 5s timeout
- `services/ai_analyzer.py`: Celery task `analyze_batch` — uses Google ADK (Gemini 2.5 Flash) with Pydantic schemas for structured output
- `services/redis_publisher.py`: Publishes to channels `cyberlens:{new_request,alert,stats_update,scan_progress,scan_complete}`

**`scanner/`** — Dependency vulnerability + code security scanning
- Models: `GitHubScan` → `Dependency` → `Vulnerability`, plus `AiReport` (1:1) and `CodeFinding` (1:N)
- Supports GitHub repos (via PAT in Django session) and local directories (validated against `LOCAL_SCAN_ROOT`)
- `services/dependency_parser.py`: Parses package.json, requirements.txt, pyproject.toml, go.mod, Gemfile
- `services/osv_scanner.py`: Celery tasks `run_full_scan` / `run_local_scan` — queries OSV API, creates records, triggers AI report + code scan
- `services/ai_reporter.py`: Generates security scores and remediation via Gemini
- `services/code_scanner.py`: AI-powered source code security analysis
- `services/github_client.py` / `local_client.py`: File fetching with extension filtering, size limits (50KB), skip dirs (node_modules, .git, etc.)

**`cyberlens/`** — Django project config
- `urls.py`: `/api/` → monitor, `/api/github/` → scanner, `/api/settings/` → API key management
- `celery.py`: Celery app with Redis broker
- `utils.py`: `get_google_api_key()` (Redis-cached), `clean_json_response()` (strips markdown from LLM output)

### Frontend Structure

- `App.tsx`: Three-tab layout — Live Monitor, Code Scan, Settings
- `services/api.ts`: REST client with dual-backend support (local + optional remote Cloud Run)
- `hooks/useSocket.ts`: Socket.IO hook for real-time events
- `theme/theme.ts`: Material You (M3) design tokens applied as CSS custom properties
- `pages/LiveMonitorPage.tsx`: Stats + D3 attack map + Recharts charts + live request stream
- `pages/SupplyChainPage.tsx`: D3 dependency tree + vulnerability list + AI remediation report + code findings
- `pages/SettingsPage.tsx`: Cloud Run URL, API key, GitHub PAT, project selection

### Realtime Service

- `src/index.ts`: Express + Socket.IO server with session-based auth (verifies via backend `/api/verify-session/`)
- `src/redis-subscriber.ts`: Subscribes to 5 Redis `cyberlens:*` channels, broadcasts parsed JSON to all Socket.IO clients

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
