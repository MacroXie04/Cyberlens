import json
import logging
from datetime import datetime, timedelta, timezone

from google.cloud import logging_v2
from google.oauth2 import service_account

logger = logging.getLogger(__name__)


def fetch_cloud_run_logs(
    *,
    service_account_key_json: str,
    project_id: str,
    service_name: str,
    max_entries: int = 100,
    hours_back: int = 1,
    severity: str | None = None,
    text_filter: str | None = None,
    page_token: str | None = None,
) -> dict:
    """Fetch logs from a Cloud Run service via Google Cloud Logging API.

    Returns a dict with "entries" (list of log dicts) and optional "next_page_token".
    """
    key_info = json.loads(service_account_key_json)
    credentials = service_account.Credentials.from_service_account_info(key_info)
    client = logging_v2.Client(project=project_id, credentials=credentials)

    # Build filter
    parts = [
        'resource.type="cloud_run_revision"',
        f'resource.labels.service_name="{service_name}"',
    ]

    time_ago = datetime.now(timezone.utc) - timedelta(hours=hours_back)
    parts.append(f'timestamp>="{time_ago.isoformat()}"')

    if severity:
        parts.append(f"severity>={severity.upper()}")

    if text_filter:
        safe_filter = text_filter.replace('"', '\\"')
        parts.append(f'textPayload:"{safe_filter}"')

    filter_str = " AND ".join(parts)

    entries = client.list_entries(
        filter_=filter_str,
        max_results=max_entries,
        order_by=logging_v2.DESCENDING,
        page_token=page_token,
    )

    results = []
    next_token = None
    page = entries.pages
    try:
        first_page = next(page)
        for entry in first_page:
            results.append(_entry_to_dict(entry))
        next_token = entries.next_page_token
    except StopIteration:
        pass

    return {"entries": results, "next_page_token": next_token}


def _entry_to_dict(entry) -> dict:
    """Convert a Cloud Logging entry to a serializable dict."""
    payload = entry.payload
    if isinstance(payload, dict):
        message = payload.get("message", json.dumps(payload))
    elif isinstance(payload, str):
        message = payload
    else:
        message = str(payload) if payload else ""

    return {
        "timestamp": entry.timestamp.isoformat() if entry.timestamp else None,
        "severity": entry.severity if entry.severity else "DEFAULT",
        "message": message,
        "log_name": entry.log_name or "",
        "trace": entry.trace or "",
        "labels": dict(entry.labels) if entry.labels else {},
    }
