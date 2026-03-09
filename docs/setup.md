# Setup

## Requirements

- Python 3.12+
- Node 20+
- Redis

## Environment

Create a root `.env` file.

Important variables:

- `GOOGLE_API_KEY`
- `LOCAL_SCAN_ROOT`
- `NGINX_LOG_PATH`
- `REDIS_URL`
- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

## Worker

```bash
cd backend
celery -A cyberlens worker -l INFO
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

## Realtime

```bash
cd realtime
npm install
npm run dev
```

## Useful Commands

```bash
cd backend && python manage.py watch_logs
cd backend && pytest
cd frontend && npm test
cd frontend && npx tsc -b
cd realtime && npm run build
```
