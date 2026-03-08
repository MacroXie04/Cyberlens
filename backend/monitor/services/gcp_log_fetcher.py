"""Fetch security-relevant logs from multiple GCP sources via Cloud Logging."""

import json
import logging
from datetime import datetime, timedelta, timezone

from google.cloud import logging_v2
from google.oauth2 import service_account

logger = logging.getLogger(__name__)


def _get_client(service_account_key_json: str, project_id: str):
    key_info = json.loads(service_account_key_json)
    credentials = service_account.Credentials.from_service_account_info(key_info)
    return logging_v2.Client(project=project_id, credentials=credentials)


def _fetch_entries(client, filter_str: str, max_entries: int = 500) -> list[dict]:
    """Run a Cloud Logging query and return normalised dicts."""
    entries = []
    try:
        for entry in client.list_entries(
            filter_=filter_str,
            max_results=max_entries,
            order_by=logging_v2.DESCENDING,
        ):
            entries.append(_entry_to_dict(entry))
    except Exception:
        logger.exception("Cloud Logging query failed: %s", filter_str[:200])
    return entries


def _entry_to_dict(entry) -> dict:
    payload = entry.payload
    if isinstance(payload, dict):
        message = payload.get("message", json.dumps(payload))
    elif isinstance(payload, str):
        message = payload
    else:
        message = str(payload) if payload else ""

    raw = payload if isinstance(payload, dict) else {}

    return {
        "timestamp": entry.timestamp.isoformat() if entry.timestamp else None,
        "severity": entry.severity if entry.severity else "DEFAULT",
        "message": message,
        "log_name": entry.log_name or "",
        "trace": entry.trace or "",
        "labels": dict(entry.labels) if entry.labels else {},
        "http_request": getattr(entry, "http_request", None),
        "resource": {
            "type": getattr(entry.resource, "type", ""),
            "labels": dict(getattr(entry.resource, "labels", {})),
        } if entry.resource else {},
        "raw": raw,
    }


def fetch_cloud_run_logs(
    *,
    service_account_key_json: str,
    project_id: str,
    services: list[str] | None = None,
    since: datetime | None = None,
    max_entries: int = 500,
) -> list[dict]:
    """Fetch Cloud Run application and request logs."""
    client = _get_client(service_account_key_json, project_id)
    since = since or (datetime.now(timezone.utc) - timedelta(seconds=30))

    parts = [
        'resource.type="cloud_run_revision"',
        f'timestamp>="{since.isoformat()}"',
    ]
    if services:
        svc_filter = " OR ".join(
            f'resource.labels.service_name="{s}"' for s in services
        )
        parts.append(f"({svc_filter})")

    return _fetch_entries(client, " AND ".join(parts), max_entries)


def fetch_load_balancer_logs(
    *,
    service_account_key_json: str,
    project_id: str,
    since: datetime | None = None,
    max_entries: int = 500,
) -> list[dict]:
    """Fetch HTTPS Load Balancer request logs."""
    client = _get_client(service_account_key_json, project_id)
    since = since or (datetime.now(timezone.utc) - timedelta(seconds=30))

    filter_str = (
        'resource.type="http_load_balancer" '
        f'AND timestamp>="{since.isoformat()}"'
    )
    return _fetch_entries(client, filter_str, max_entries)


def fetch_cloud_armor_logs(
    *,
    service_account_key_json: str,
    project_id: str,
    since: datetime | None = None,
    max_entries: int = 500,
) -> list[dict]:
    """Fetch Cloud Armor security policy logs (WAF blocks etc.)."""
    client = _get_client(service_account_key_json, project_id)
    since = since or (datetime.now(timezone.utc) - timedelta(seconds=30))

    filter_str = (
        'resource.type="http_load_balancer" '
        'AND jsonPayload.enforcedSecurityPolicy.name!="" '
        f'AND timestamp>="{since.isoformat()}"'
    )
    return _fetch_entries(client, filter_str, max_entries)


def fetch_iam_audit_logs(
    *,
    service_account_key_json: str,
    project_id: str,
    since: datetime | None = None,
    max_entries: int = 500,
) -> list[dict]:
    """Fetch IAM / Admin Activity audit logs."""
    client = _get_client(service_account_key_json, project_id)
    since = since or (datetime.now(timezone.utc) - timedelta(seconds=30))

    filter_str = (
        'logName:"cloudaudit.googleapis.com" '
        f'AND timestamp>="{since.isoformat()}"'
    )
    return _fetch_entries(client, filter_str, max_entries)


def fetch_iap_logs(
    *,
    service_account_key_json: str,
    project_id: str,
    since: datetime | None = None,
    max_entries: int = 500,
) -> list[dict]:
    """Fetch Identity-Aware Proxy access logs."""
    client = _get_client(service_account_key_json, project_id)
    since = since or (datetime.now(timezone.utc) - timedelta(seconds=30))

    filter_str = (
        'resource.type="gce_backend_service" '
        'AND logName:"iap" '
        f'AND timestamp>="{since.isoformat()}"'
    )
    return _fetch_entries(client, filter_str, max_entries)
