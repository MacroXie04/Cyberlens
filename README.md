# CyberLens

CyberLens is a full-stack security dashboard for two related workflows:

- real-time monitoring of HTTP traffic from structured Nginx access logs
- AI-assisted supply chain and source code security scanning for GitHub repos and local projects

The project combines a Django API, a React dashboard, a Socket.IO realtime service, Redis pub/sub, Celery background jobs, and PostgreSQL.

## What It Does

- Ingests JSON Nginx access logs and turns them into live request events
- Runs AI threat analysis on batched traffic using Google Gemini via Google ADK
- Scans dependency manifests against the OSV vulnerability database
- Performs AI-assisted code security analysis on application source files
- Streams scan progress and code scan activity to the frontend in real time
- Supports both GitHub repositories and local directories
- Lets the monitoring dashboard point at a remote Cloud Run instance while keeping scanning local

## Architecture

```text
Nginx JSON logs
  -> Django log watcher
  -> Celery analysis tasks
  -> PostgreSQL + Redis pub/sub
  -> Node/Socket.IO realtime bridge
  -> React dashboard

GitHub repo or local project
  -> Django scanner endpoints
  -> Celery dependency/code scan tasks
  -> OSV + Gemini analysis
  -> PostgreSQL + Redis pub/sub
  -> React dashboard
```

## Stack

- `frontend/`: React 18, TypeScript, Vite, D3, Recharts, Socket.IO client
- `backend/`: Django 5, Django REST Framework, Celery, Redis, PostgreSQL
- `realtime/`: Node.js, Express, Socket.IO, ioredis
- `nginx/`: sample Nginx config that emits JSON access logs

## Run with Docker

CyberLens can run entirely with Docker Compose. This is the recommended way to start the full application because it brings up the frontend, backend, Celery worker, realtime server, PostgreSQL, and Redis together.

The current frontend proxy configuration also assumes the Docker service names `backend` and `realtime`.

### 1. Configure environment variables

Copy the example file and update the values you need:

```bash
cp .env.example .env
```

Important values:

- `GOOGLE_API_KEY`: required for AI threat analysis, AI remediation reports, and code scanning
- `LOCAL_SCAN_ROOT`: host directory that should be mounted read-only into the containers for local project scans
- `NGINX_LOG_PATH`: path watched by the log watcher for JSON access logs

The provided `.env.example` already contains working local defaults for PostgreSQL, Redis, and Django.

### 2. Build and start the stack

```bash
docker compose up --build
```

This starts these containers:

- frontend: [http://localhost:5173](http://localhost:5173)
- backend: [http://localhost:8000](http://localhost:8000)
- realtime: [http://localhost:3001/health](http://localhost:3001/health)
- worker: Celery background jobs
- postgres: `localhost:5432`
- redis: `localhost:6379`

### 3. Run database migrations

In a second terminal:

```bash
docker compose exec backend python manage.py migrate
```

### 4. Create a user session for the app

The API uses Django session authentication by default, and the current frontend does not include a dedicated login screen yet.

The simplest browser-based flow is:

```bash
docker compose exec backend python manage.py createsuperuser
```

Then sign in at [http://localhost:8000/admin/](http://localhost:8000/admin/). The Django session cookie is scoped to `localhost`, so the frontend on port `5173` can reuse it for proxied `/api` calls.

If you prefer API auth, the backend also exposes:

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `GET /api/auth/me/`

### 5. Start log watching for live monitoring

The Compose file starts the web server, worker, Redis, and database, but the Nginx log watcher is a separate process. Start it in another terminal:

```bash
docker compose exec backend python manage.py watch_logs
```

CyberLens expects newline-delimited JSON access logs at `NGINX_LOG_PATH`. A sample Nginx config is available in [`nginx/nginx.conf`](nginx/nginx.conf).

### 6. Stop the stack

```bash
docker compose down
```

If you also want to remove the PostgreSQL volume:

```bash
docker compose down -v
```

## Local Development Without Docker

You can run the services directly, but there is one important caveat: [`frontend/vite.config.ts`](frontend/vite.config.ts) currently proxies `/api` to `http://backend:8000` and `/socket.io` to `http://realtime:3001`. If you run the frontend on the host instead of inside Docker, change those proxy targets to `localhost` first.

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

In separate terminals:

```bash
cd backend
celery -A cyberlens worker -l INFO
```

```bash
cd backend
python manage.py watch_logs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Realtime

```bash
cd realtime
npm install
npm run dev
```

## Environment Variables

Core settings are loaded from the repository root `.env`.

| Variable | Purpose |
| --- | --- |
| `POSTGRES_DB` | PostgreSQL database name used by Compose |
| `POSTGRES_USER` | PostgreSQL username used by Compose |
| `POSTGRES_PASSWORD` | PostgreSQL password used by Compose |
| `DATABASE_URL` | Django database connection string |
| `REDIS_URL` | Redis connection string used by Django, Celery, and realtime |
| `GOOGLE_API_KEY` | Gemini API key used for AI analysis |
| `DJANGO_SECRET_KEY` | Django secret key |
| `DJANGO_DEBUG` | Enables Django debug mode when `true` |
| `ALLOWED_HOSTS` | Comma-separated Django allowed hosts |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed frontend origins |
| `NGINX_LOG_PATH` | Path to the structured access log watched by `watch_logs` |
| `LOCAL_SCAN_ROOT` | Base directory exposed for local project scans |

## Project Layout

```text
.
├── backend/    Django API, Celery tasks, auth, monitor, scanner
├── frontend/   React dashboard
├── realtime/   Socket.IO bridge for Redis pub/sub events
├── nginx/      Example JSON access-log Nginx config
├── docker-compose.yml
└── .env.example
```

## Key API Areas

- `GET /api/requests/`, `GET /api/stats/overview/`, `GET /api/stats/timeline/`, `GET /api/stats/geo/`
- `GET /api/github/status/`, `POST /api/github/connect/`, `GET /api/github/repos/`
- `POST /api/github/scan/`, `POST /api/github/local/scan/`
- `GET /api/github/scan/<id>/`, `GET /api/github/scan/<id>/ai-report/`, `GET /api/github/scan/<id>/code-findings/`
- `GET /api/settings/`, `PUT /api/settings/`, `POST /api/settings/test-key/`

## Testing

Backend tests are configured with `pytest`:

```bash
cd backend
pytest
```

You can also run targeted suites:

```bash
pytest monitor/tests/
pytest scanner/tests/
```

## Notes

- Local scanning is restricted to directories under `LOCAL_SCAN_ROOT`.
- Source code scanning ignores common generated/vendor directories such as `node_modules`, `.git`, `dist`, `build`, and virtual environments.
- The realtime service validates the Django session before allowing a Socket.IO connection.
- Monitoring data comes from structured Nginx logs; if you do not run `watch_logs`, the Live Monitor page will stay idle.
