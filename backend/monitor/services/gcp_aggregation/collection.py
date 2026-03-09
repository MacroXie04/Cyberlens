import hashlib
from datetime import datetime, timedelta, timezone

from django.core.cache import cache
from django.utils.dateparse import parse_datetime

DEFAULT_SOURCES = ["cloud_run_logs", "cloud_monitoring", "load_balancer", "cloud_armor", "iam_audit", "iap"]


def get_gcp_config(user):
    from accounts.models import UserSettings

    try:
        settings = UserSettings.objects.get(user=user)
    except UserSettings.DoesNotExist:
        return None
    if not settings.gcp_project_id or not settings.gcp_service_account_key:
        return None
    return {"service_account_key_json": settings.gcp_service_account_key, "project_id": settings.gcp_project_id, "regions": settings.gcp_regions or [], "service_filters": settings.gcp_service_filters or [], "enabled_sources": settings.gcp_enabled_sources or DEFAULT_SOURCES}


def get_last_fetch_time(user_id: int, source: str) -> datetime:
    cached = cache.get(f"gcp_last_fetch:{user_id}:{source}")
    return datetime.fromisoformat(cached) if cached else datetime.now(timezone.utc) - timedelta(seconds=30)


def set_last_fetch_time(user_id: int, source: str, ts: datetime) -> None:
    cache.set(f"gcp_last_fetch:{user_id}:{source}", ts.isoformat(), timeout=3600)


def parse_dt(value) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        parsed = parse_datetime(value[:-1] + "+00:00" if value.endswith("Z") else value)
        return parsed if parsed is None or parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return None


def event_fingerprint(event: dict) -> str:
    payload = "|".join(str(event.get(field) or "") for field in ("source", "project_id", "timestamp", "region", "service", "revision", "source_ip", "principal", "path", "method", "status_code", "trace_id", "request_id", "country", "category", "severity"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def collect_parsed_events(*, project_id: str, service_account_key_json: str, enabled_sources: list[str], service_filters: list[str] | None, since: datetime, max_entries: int):
    from monitor.services import gcp_event_parser, gcp_log_fetcher

    parsed_events, source_errors = [], {}
    source_specs = [
        ("cloud_run_logs", gcp_log_fetcher.fetch_cloud_run_logs, gcp_event_parser.parse_cloud_run_log, {"services": service_filters}),
        ("load_balancer", gcp_log_fetcher.fetch_load_balancer_logs, gcp_event_parser.parse_load_balancer_log, {}),
        ("cloud_armor", gcp_log_fetcher.fetch_cloud_armor_logs, gcp_event_parser.parse_cloud_armor_log, {}),
        ("iam_audit", gcp_log_fetcher.fetch_iam_audit_logs, gcp_event_parser.parse_iam_audit_log, {}),
        ("iap", gcp_log_fetcher.fetch_iap_logs, gcp_event_parser.parse_iap_log, {}),
    ]
    for source_name, fetch_fn, parse_fn, extra_kwargs in source_specs:
        if source_name not in enabled_sources:
            continue
        try:
            entries = fetch_fn(service_account_key_json=service_account_key_json, project_id=project_id, since=since, max_entries=max_entries, **extra_kwargs)
            parsed_events.extend(parsed for entry in entries if (parsed := parse_fn(entry, project_id)))
        except Exception as exc:
            source_errors[source_name] = str(exc)
    return parsed_events, source_errors
