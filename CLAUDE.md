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
pytest scanner/tests/views/     # views tests only
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

### Backend Structure

The backend uses a domain-based directory structure within the `scanner/` app:

**Models** (`scanner/models/`) — split by domain:
- `scan.py`: `GitHubScan`, `AiReport` (1:1 with scan)
- `dependency.py`: `Dependency`, `Vulnerability`, `CodeFinding`
- `trace.py`: `AdkTraceEvent`, `CodeScanFileIndex`, `CodeScanChunk`, `CodeScanCandidate`
- `codemap.py`: `CodeMapNode`, `CodeMapEdge`

**API layer** (`scanner/api/`) — views organized by concern:
- `github_auth.py`: GitHub PAT status/connect/disconnect/repos
- `scan_runs.py`: scan initiation and listing
- `scan_results.py`: AI report, code findings, ADK trace results
- `code_map.py`: code map data
- `settings.py`: user settings endpoints

**Services** (`scanner/services/`) — organized into subdirectories:
- `clients/`: `github_client.py`, `local_client.py` — file fetching with extension filtering, size limits (50KB), skip dirs
- `scanning/`: `dependency_parser.py` (parses package.json, requirements.txt, pyproject.toml, go.mod, Gemfile), `osv_scanner.py` (Celery tasks `run_full_scan`/`run_local_scan`)
- `ai_reporting/stages/`: multi-stage AI report generation via Gemini
- `adk_trace/`: trace event handling
- `code_pipeline/`: multi-stage AI code analysis pipeline
  - `preparation/`: inventory, profiles, summarization, codemap
  - `analysis/`: candidates, evidence, synthesis, verification
  - `orchestrator.py`: main pipeline orchestration
  - `llm.py`, `runner.py`, `progress.py`: shared pipeline infrastructure
- `adk_code_pipeline.py`: facade that delegates to `code_pipeline/`

**Serializers** (`scanner/serializers/`) — split to match models: `core.py`, `scan.py`, `trace.py`, `codemap.py`

**Tests** (`scanner/tests/`) — organized by domain:
- `clients/`, `code_scanner/`, `services/`, `views/`

**`accounts/`** — User auth and per-user settings
- `UserSettings` (1:1 with User): google_api_key, github_pat, gemini_model
- `GeminiLog`: Audit trail for all Gemini API calls (tokens, duration, status)

**`cyberlens/`** — Django project config
- `urls.py`: `/api/auth/` → accounts, `/api/github/` → scanner, `/api/settings/` → API key management
- `redis_publisher.py`: Publishes to channels `cyberlens:{scan_progress,scan_complete,code_scan_stream,adk_trace_stream}`
- `celery.py`: Celery app with Redis broker
- `utils.py`: `get_google_api_key()` (Redis-cached), `clean_json_response()` (strips markdown from LLM output), `log_gemini_call()` audit logging

### Frontend Structure

The frontend uses a feature-based directory structure under `src/`:

**`app/`** — Shell and routing
- `router.tsx`: Routes — login, register, dashboard
- `DashboardShell.tsx`: Two-tab layout (Supply Chain, Settings)

**`features/`** — Domain modules, each with `api/`, `components/`, `hooks/`, `lib/`, `pages/`, `types/`:
- `supply-chain/`: Main scanning feature — SupplyChainPage, scan hooks, pipeline progress, trace snapshots
- `settings/`: Settings management
- `auth/`: Login/register flows

**`components/SupplyChain/`** — Shared UI components organized by subdirectory: `activity/`, `agent-panel/`, `agent-log/`, `code-findings/`, `code-scan/`, `dependencies/`, `inventory/`, `remediation/`, `vulnerabilities/`, `code-map/`

**`shared/`** — Cross-feature code (e.g., `shared/api/client.ts` for the base REST client with CSRF injection)

**`services/api.ts`** — Re-export aggregator that combines feature-specific API modules

**`pages/`** — Re-export wrappers pointing to actual implementations in `features/`

**Tests** (`__tests__/`) — organized by domain: `app/`, `auth/`, `services/`, `settings/`, `supply-chain/`

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
