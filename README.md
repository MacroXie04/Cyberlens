# CyberLens

**AI-powered security monitoring and vulnerability scanning dashboard.**

CyberLens is a full-stack security platform that combines real-time GCP infrastructure monitoring with AI-driven supply chain and source code vulnerability scanning. It uses Google Gemini (via Google ADK) for intelligent threat analysis and remediation guidance, streams events to the browser in real time over WebSockets, and scans both GitHub repositories and local projects.

## Screenshots

### Live Monitor — GCP Security SOC Dashboard

![Live Monitor](Screenshots/LiveMonitor.png)

Real-time security operations center view with estate matrix, global threat timeline, perimeter event lanes, geo attack map, and incident feed. Monitors Cloud Run services, Load Balancer traffic, Cloud Armor rules, IAM audit logs, and IAP events.

### Code Scan — Supply Chain & Vulnerability Analysis

![Code Scan](Screenshots/CodeScan.png)

Scan GitHub repos or local projects for dependency vulnerabilities (via OSV) and source code security issues. Displays dependency counts, vulnerability stats, an AI-generated repository security summary, and a full agent request log tracing the multi-stage ADK analysis pipeline.

### Code Security Findings

![Code Security Findings](Screenshots/CodeSecurityFindings.png)

Detailed code-level security findings with severity ratings, CWE classifications, affected file locations, and AI-generated remediation guidance for each issue.

### Settings

![Settings](Screenshots/Settings.png)

Configure GCP service account credentials, Google API key, Gemini model selection, GitHub PAT connection, and select repositories for scanning.

## Features

- **GCP Security SOC** — Polls Cloud Run, Load Balancer, Cloud Armor, IAM Audit, and IAP logs; classifies events with pattern-based attack detection; clusters events into incidents with configurable thresholds
- **Real-time streaming** — All events flow through Redis pub/sub to a Socket.IO bridge, delivering live updates to the browser with no polling
- **Dependency scanning** — Parses `package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`, and `Gemfile`; queries the OSV vulnerability database
- **AI code security analysis** — Multi-stage ADK pipeline: file inventory, chunking, summarization, 7 risk analysis passes, candidate generation, evidence expansion, verification, and repository-level synthesis
- **AI threat analysis** — Batched HTTP traffic analysis and security remediation reports powered by Gemini
- **Dual scan targets** — Scan GitHub repositories (via PAT) or local directories
- **Hybrid deployment** — Point the monitoring dashboard at a remote Cloud Run backend while keeping code scanning local

## Architecture

```
GCP Logs / Nginx JSON logs
  --> Django log watcher + GCP aggregator
  --> Celery background tasks (analysis, scanning, AI pipelines)
  --> SQLite + Redis pub/sub
  --> Node.js Socket.IO realtime bridge
  --> React dashboard

GitHub repo or local project
  --> Django scanner endpoints
  --> Celery dependency + code scan tasks
  --> OSV API + Gemini ADK analysis
  --> SQLite + Redis pub/sub
  --> React dashboard
```

## Tech Stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | React 18, TypeScript, Vite, D3, Recharts, Material You (M3), Socket.IO client |
| **Backend** | Django 5.1, Django REST Framework, Celery, Python 3.12 |
| **AI** | Google ADK, Gemini 2.5 Flash, Pydantic structured output |
| **Realtime** | Node.js, Express, Socket.IO, ioredis |
| **Infrastructure** | SQLite, Redis, Nginx |

## Quick Start

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env — set GOOGLE_API_KEY at minimum

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate          # creates local SQLite database
python manage.py createsuperuser  # create a user
python manage.py runserver 0.0.0.0:8000

# 3. Celery worker (separate terminal)
cd backend && celery -A cyberlens worker -l INFO

# 4. Frontend (separate terminal)
cd frontend && npm install && npm run dev

# 5. Realtime (separate terminal)
cd realtime && npm install && npm run dev

# 6. Sign in at http://localhost:8000/admin/
#    Then open http://localhost:5173
```

Services run on:

| Service | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Realtime | http://localhost:3001 |

Redis must be running locally on `localhost:6379` (used by Celery and the realtime service).

To start the Nginx log watcher for live HTTP monitoring:

```bash
cd backend && python manage.py watch_logs
```

## Authentication

The API uses Django session authentication. After creating a superuser and signing in via `/admin/`, the session cookie works for the frontend on `localhost:5173`.

API auth endpoints are also available:

```
POST /api/auth/register/
POST /api/auth/login/
POST /api/auth/logout/
GET  /api/auth/me/
```

## Environment Variables

Core settings are loaded from the repository root `.env`. See [`.env.example`](.env.example) for defaults.

| Variable | Purpose |
| --- | --- |
| `GOOGLE_API_KEY` | Gemini API key for AI analysis (also settable via UI) |
| `LOCAL_SCAN_ROOT` | Base directory for local project scans |
| `NGINX_LOG_PATH` | Path to Nginx JSON access log for live monitoring |
| `REDIS_URL` | Redis connection string for Celery, pub/sub, and realtime |
| `DJANGO_SECRET_KEY` | Django secret key |
| `DJANGO_DEBUG` | Enable Django debug mode (`true`/`false`) |
| `ALLOWED_HOSTS` | Comma-separated Django allowed hosts |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed frontend origins |

## API Reference

### Monitoring

```
GET  /api/requests/
GET  /api/stats/overview/
GET  /api/stats/timeline/
GET  /api/stats/geo/
```

### GCP Security

```
GET  /api/gcp-estate/summary/
GET  /api/gcp-estate/services/
GET  /api/gcp-estate/timeseries/
POST /api/gcp-estate/refresh/
GET  /api/gcp-security/events/
GET  /api/gcp-security/incidents/
GET  /api/gcp-security/incidents/:id/
POST /api/gcp-security/incidents/:id/ack/
GET  /api/gcp-security/map/
```

### Scanner

```
GET  /api/github/status/
POST /api/github/connect/
GET  /api/github/repos/
POST /api/github/scan/
POST /api/github/local/scan/
GET  /api/github/scan/:id/
GET  /api/github/scan/:id/ai-report/
GET  /api/github/scan/:id/code-findings/
```

### Settings

```
GET  /api/settings/
PUT  /api/settings/
POST /api/settings/test-key/
```

## Testing

```bash
# Backend (pytest)
cd backend
pytest                          # all tests
pytest monitor/tests/           # monitor app tests
pytest scanner/tests/           # scanner app tests
pytest -k test_scan_detail      # single test by name

# Frontend (vitest + type check)
cd frontend
npm test                        # vitest
npx tsc -b                      # type check
```

CI runs on push/PR to `main` via GitHub Actions — Python 3.12 pytest + Node 20 type check and vitest.

## Project Layout

```
.
├── backend/           Django API, Celery tasks, auth, monitor, scanner
│   ├── accounts/      User auth and per-user settings
│   ├── monitor/       HTTP monitoring + GCP Security SOC
│   ├── scanner/       Dependency + code security scanning
│   └── cyberlens/     Django project config, Celery, utilities
├── frontend/          React 18 TypeScript dashboard
│   ├── pages/         LiveMonitorPage, SupplyChainPage, SettingsPage
│   ├── services/      API client, Socket.IO hooks
│   └── theme/         Material You design tokens
├── realtime/          Node.js Socket.IO ↔ Redis pub/sub bridge
├── nginx/             Example JSON access-log Nginx config
└── .env.example
```

## License

This project is not currently published under an open-source license.
