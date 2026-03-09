# API Reference

## Auth

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `GET /api/auth/me/`

## Basic Monitoring

- `GET /api/requests/`
- `GET /api/stats/overview/`
- `GET /api/stats/timeline/`
- `GET /api/stats/geo/`
- `GET /api/cloud-run-logs/`
- `GET /api/verify-session/`

## GCP Estate

- `GET /api/gcp-estate/summary/`
- `GET /api/gcp-estate/services/`
- `GET /api/gcp-estate/timeseries/`
- `GET /api/gcp-estate/timeline/`
- `GET /api/gcp-estate/replay-snapshot/`
- `POST /api/gcp-estate/refresh/`
- `POST /api/gcp-estate/ensure-collection/`
- `POST /api/gcp-estate/ensure-history/`

## GCP Security

- `GET /api/gcp-security/events/`
- `GET /api/gcp-security/incidents/`
- `GET /api/gcp-security/incidents/:id/`
- `POST /api/gcp-security/incidents/:id/ack/`
- `GET /api/gcp-security/map/`

## Scanner

- `GET /api/github/status/`
- `POST /api/github/connect/`
- `DELETE /api/github/disconnect/`
- `GET /api/github/repos/`
- `POST /api/github/scan/`
- `GET /api/github/scans/?repo=<owner/repo>`
- `GET /api/github/scan/:id/`
- `GET /api/github/scan/:id/ai-report/`
- `GET /api/github/scan/:id/code-findings/`
- `GET /api/github/scan/:id/adk-trace/`
- `GET /api/github/local/projects/`
- `POST /api/github/local/scan/`

## Settings

- `GET /api/settings/`
- `PUT /api/settings/`
- `POST /api/settings/test-key/`
- `GET /api/settings/models/`
- `GET /api/settings/gcp/`
- `PUT /api/settings/gcp/`
