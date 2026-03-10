# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CyberLens is a full-stack security dashboard with three services:
- **backend/** — Django 5.1 REST API (Python 3.12) with Celery workers
- **frontend/** — React 18 SPA (TypeScript, Vite)
- **realtime/** — Node.js Socket.IO server bridging Redis pub/sub to WebSocket clients

Infrastructure: Redis. Local dev uses SQLite; Docker uses PostgreSQL (via `DATABASE_URL`).

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
pytest scanner/tests/           # scanner app tests
pytest scanner/tests/test_views.py  # single test file
pytest -k test_scan_detail      # single test by name

# Frontend (vitest + type check)
cd frontend
npm test                        # vitest run (all tests)
npx tsc -b                      # type check only (no emit)
```
Backend config: `pytest.ini` sets `DJANGO_SETTINGS_MODULE=cyberlens.settings`, strict markers, verbose output, short traceback.

Fixtures in `conftest.py`: factories for scanner models (`scan_factory`, `dependency_factory`, `vulnerability_factory`, etc.), `mock_redis`, auto-use `_use_locmem_cache`.

### CI
GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main`:
- **Backend Tests**: Python 3.12, pytest with Redis service (SQLite for CI)
- **Frontend Checks**: Node 20, `tsc -b` type check + `npm test` (vitest)

## Architecture

### Data Flow
```
Frontend ←── Socket.IO ←── Realtime ←── Redis pub/sub ←── Backend publishes events
    |                                                          ↑
    └── REST API calls (/api/*) ──────────────────────────────┘
```

### Backend Apps

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
- `UserSettings` (1:1 with User): google_api_key, github_pat, gemini_model
- `GeminiLog`: Audit trail for all Gemini API calls (tokens, duration, status)

**`cyberlens/`** — Django project config
- `urls.py`: `/api/auth/` → accounts, `/api/github/` → scanner, `/api/settings/` → API key management
- `redis_publisher.py`: Publishes to channels `cyberlens:{scan_progress,scan_complete,code_scan_stream,adk_trace_stream}`
- `celery.py`: Celery app with Redis broker
- `utils.py`: `get_google_api_key()` (Redis-cached), `clean_json_response()` (strips markdown from LLM output), `log_gemini_call()` audit logging

### Frontend Structure

- `App.tsx`: Two-tab layout — Code Scan, Settings
- `services/api.ts`: REST client with auto CSRF token injection
- `hooks/useSocket.ts`: Socket.IO hook for real-time events (listens to 4 scanner Redis channels)
- `theme/theme.ts`: Material You (M3) design tokens
- `types/index.ts`: All TypeScript interfaces (auth, scanner, settings types)
- `pages/SupplyChainPage.tsx`: D3 dependency tree + vulnerability list + AI remediation report + code findings + ADK pipeline trace
- `pages/SettingsPage.tsx`: API key, GitHub PAT, project selection

### Realtime Service

- `src/index.ts`: Express + Socket.IO server with session-based auth (verifies via backend `/api/auth/verify-session/`)
- `src/redis-subscriber.ts`: Subscribes to 4 Redis `cyberlens:*` channels, broadcasts parsed JSON to all Socket.IO clients

### Key Environment Variables (see .env.example)
- `REDIS_URL` — Redis connection string (used by Celery and realtime service)
- `GOOGLE_API_KEY` — Gemini API key (also settable via UI, cached in Redis)
- `LOCAL_SCAN_ROOT` — Base directory for local project scanning (maps to `/scan-targets` in container)
- `DATABASE_URL` — PostgreSQL connection string (Docker only; local dev uses SQLite via `settings.py` default)

### Conventions
- Backend uses Django REST Framework serializers for all API responses
- AI integrations use Google ADK `InMemoryRunner` with Pydantic models for structured output
- All real-time communication flows through Redis pub/sub → Socket.IO (never direct backend→frontend WebSocket)
- Frontend uses inline styles with CSS custom properties from theme; no CSS framework
- GitHub PATs are stored in Django sessions, not environment variables
- Celery runs in eager mode during dev/test (tasks execute synchronously)
- Frontend dev proxy: `/api` → `http://localhost:8000`, `/socket.io` → `http://localhost:3001` (configured in `vite.config.ts`)
- Frontend tests use vitest + jsdom + React Testing Library; socket.io-client is globally mocked in test setup
- All Gemini API calls are audited to the `GeminiLog` table with token counts and duration
