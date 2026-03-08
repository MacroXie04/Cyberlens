"""GCP Observability Aggregator tasks and history helpers."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone

from celery import shared_task
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db.models import Max, Min
from django.utils.dateparse import parse_datetime

from monitor.models import (
    GcpObservedService,
    GcpSecurityEvent,
    GcpSecurityIncident,
    GcpServiceHealth,
)
from monitor.services.redis_publisher import (
    publish_gcp_estate_snapshot,
    publish_gcp_incident_update,
    publish_gcp_security_event,
    publish_gcp_service_health,
    publish_gcp_timeseries_update,
)

logger = logging.getLogger(__name__)

DEFAULT_SOURCES = [
    "cloud_run_logs",
    "cloud_monitoring",
    "load_balancer",
    "cloud_armor",
    "iam_audit",
    "iap",
]

DEFAULT_HISTORY_DAYS = 30
HISTORY_RETENTION_DAYS = 35

_NOT_CONFIGURED_MSG = (
    "GCP not configured — set project ID and service account key in Settings"
)


# ---------------------------------------------------------------------------
# Collection error helpers
# ---------------------------------------------------------------------------

def _collection_errors_key(user_id: int) -> str:
    return f"gcp_collection_errors:{user_id}"


def _set_collection_error(user_id: int, source: str, message: str):
    key = _collection_errors_key(user_id)
    errors = cache.get(key) or {}
    errors[source] = message
    cache.set(key, errors, timeout=300)


def _clear_collection_error(user_id: int, source: str):
    key = _collection_errors_key(user_id)
    errors = cache.get(key)
    if errors and source in errors:
        del errors[source]
        cache.set(key, errors, timeout=300)


def get_collection_errors(user_id: int) -> dict:
    return cache.get(_collection_errors_key(user_id)) or {}


# ---------------------------------------------------------------------------
# History status helpers
# ---------------------------------------------------------------------------

def _history_status_key(user_id: int) -> str:
    return f"gcp_history_status:{user_id}"


def _set_history_status(user_id: int, status: dict):
    cache.set(_history_status_key(user_id), status, timeout=3600)


def get_history_status(user_id: int) -> dict:
    return cache.get(_history_status_key(user_id)) or {"state": "idle"}


def _history_trigger_key(user_id: int, days: int) -> str:
    return f"gcp_history_backfill_triggered:{user_id}:{days}"


# ---------------------------------------------------------------------------
# Common helpers
# ---------------------------------------------------------------------------

def _get_gcp_config(user):
    from accounts.models import UserSettings

    try:
        settings = UserSettings.objects.get(user=user)
    except UserSettings.DoesNotExist:
        return None

    if not settings.gcp_project_id or not settings.gcp_service_account_key:
        return None

    return {
        "service_account_key_json": settings.gcp_service_account_key,
        "project_id": settings.gcp_project_id,
        "regions": settings.gcp_regions or [],
        "service_filters": settings.gcp_service_filters or [],
        "enabled_sources": settings.gcp_enabled_sources or DEFAULT_SOURCES,
    }


def _get_last_fetch_time(user_id: int, source: str) -> datetime:
    key = f"gcp_last_fetch:{user_id}:{source}"
    cached = cache.get(key)
    if cached:
        return datetime.fromisoformat(cached)
    return datetime.now(timezone.utc) - timedelta(seconds=30)


def _set_last_fetch_time(user_id: int, source: str, ts: datetime):
    key = f"gcp_last_fetch:{user_id}:{source}"
    cache.set(key, ts.isoformat(), timeout=3600)


def _parse_dt(value) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        parsed = parse_datetime(value)
        if parsed is not None:
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return None


def _event_fingerprint(evt: dict) -> str:
    payload = "|".join(
        str(evt.get(field) or "")
        for field in (
            "source",
            "project_id",
            "timestamp",
            "region",
            "service",
            "revision",
            "source_ip",
            "principal",
            "path",
            "method",
            "status_code",
            "trace_id",
            "request_id",
            "country",
            "category",
            "severity",
        )
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _cleanup_old_data(user, project_id: str, retention_days: int = HISTORY_RETENTION_DAYS):
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    GcpServiceHealth.objects.filter(
        user=user,
        project_id=project_id,
        bucket_end__lt=cutoff,
    ).delete()
    GcpSecurityEvent.objects.filter(
        user=user,
        project_id=project_id,
        timestamp__lt=cutoff,
    ).delete()


def _get_history_coverage(user, project_id: str) -> tuple[datetime | None, datetime | None]:
    health_bounds = GcpServiceHealth.objects.filter(
        user=user,
        project_id=project_id,
    ).aggregate(min_ts=Min("bucket_end"), max_ts=Max("bucket_end"))
    event_bounds = GcpSecurityEvent.objects.filter(
        user=user,
        project_id=project_id,
    ).aggregate(min_ts=Min("timestamp"), max_ts=Max("timestamp"))
    incident_bounds = GcpSecurityIncident.objects.filter(
        user=user,
        project_id=project_id,
    ).aggregate(min_ts=Min("first_seen"), max_ts=Max("last_seen"))

    starts = [
        value
        for value in (
            health_bounds["min_ts"],
            event_bounds["min_ts"],
            incident_bounds["min_ts"],
        )
        if value is not None
    ]
    ends = [
        value
        for value in (
            health_bounds["max_ts"],
            event_bounds["max_ts"],
            incident_bounds["max_ts"],
        )
        if value is not None
    ]
    return (min(starts) if starts else None, max(ends) if ends else None)


def get_history_metadata(user, project_id: str) -> dict:
    coverage_start, coverage_end = _get_history_coverage(user, project_id)
    status = get_history_status(user.id)
    return {
        "coverage_start": coverage_start.isoformat() if coverage_start else None,
        "coverage_end": coverage_end.isoformat() if coverage_end else None,
        "history_ready": bool(coverage_start or coverage_end),
        "backfill_status": status,
    }


def _upsert_health_samples(
    *,
    user,
    project_id: str,
    samples: list[dict],
    publish: bool,
) -> list[GcpServiceHealth]:
    if not samples:
        return []

    rows: list[GcpServiceHealth] = []
    for sample in samples:
        bucket_end = _parse_dt(sample.get("bucket_end"))
        if bucket_end is None:
            continue
        bucket_start = bucket_end - timedelta(minutes=5)
        rows.append(
            GcpServiceHealth(
                user=user,
                project_id=project_id,
                service_name=sample.get("service_name", "unknown"),
                region=sample.get("region", ""),
                request_count=int(round(sample.get("requests", 0) or 0)),
                error_count=int(round(sample.get("errors", 0) or 0)),
                latency_p50_ms=float(sample.get("latency_p50_ms", 0) or 0),
                latency_p95_ms=float(sample.get("latency_p95_ms", 0) or 0),
                latency_p99_ms=float(sample.get("latency_p99_ms", 0) or 0),
                instance_count=int(round(sample.get("instances", 0) or 0)),
                max_concurrency=float(sample.get("max_concurrency", 0) or 0),
                cpu_utilization=float(sample.get("cpu_utilization", 0) or 0),
                memory_utilization=float(sample.get("memory_utilization", 0) or 0),
                unhealthy_revision_count=int(round(sample.get("unhealthy_revision_count", 0) or 0)),
                bucket_start=bucket_start,
                bucket_end=bucket_end,
            )
        )

    if not rows:
        return []

    GcpServiceHealth.objects.bulk_create(
        rows,
        update_conflicts=True,
        update_fields=[
            "request_count",
            "error_count",
            "latency_p50_ms",
            "latency_p95_ms",
            "latency_p99_ms",
            "instance_count",
            "max_concurrency",
            "cpu_utilization",
            "memory_utilization",
            "unhealthy_revision_count",
            "bucket_start",
        ],
        unique_fields=["user", "project_id", "service_name", "region", "bucket_end"],
    )

    created_rows = list(
        GcpServiceHealth.objects.filter(
            user=user,
            project_id=project_id,
            bucket_end__in=[row.bucket_end for row in rows],
            service_name__in=[row.service_name for row in rows],
        )
    )

    if publish:
        for health in created_rows:
            publish_gcp_service_health(_serialize_health(health))

    return created_rows


def _persist_events(
    *,
    user,
    project_id: str,
    event_dicts: list[dict],
    publish: bool,
    run_rule_engine: bool,
) -> list[GcpSecurityEvent]:
    if not event_dicts:
        return []

    unique_events: list[dict] = []
    fingerprints: list[str] = []
    seen: set[str] = set()
    for event_dict in event_dicts:
        event_dict["project_id"] = event_dict.get("project_id") or project_id
        fingerprint = _event_fingerprint(event_dict)
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        event_dict["fingerprint"] = fingerprint
        unique_events.append(event_dict)
        fingerprints.append(fingerprint)

    existing = set(
        GcpSecurityEvent.objects.filter(
            user=user,
            project_id=project_id,
            fingerprint__in=fingerprints,
        ).values_list("fingerprint", flat=True)
    )

    db_events: list[GcpSecurityEvent] = []
    for event_dict in unique_events:
        if event_dict["fingerprint"] in existing:
            continue
        db_events.append(
            GcpSecurityEvent(
                user=user,
                source=event_dict["source"],
                timestamp=_parse_dt(event_dict["timestamp"]),
                project_id=event_dict["project_id"],
                region=event_dict.get("region", ""),
                service=event_dict.get("service", ""),
                revision=event_dict.get("revision", ""),
                severity=event_dict.get("severity", "info"),
                category=event_dict.get("category", "other"),
                source_ip=event_dict.get("source_ip"),
                principal=event_dict.get("principal", ""),
                path=event_dict.get("path", ""),
                method=event_dict.get("method", ""),
                status_code=event_dict.get("status_code"),
                trace_id=event_dict.get("trace_id", ""),
                request_id=event_dict.get("request_id", ""),
                fingerprint=event_dict["fingerprint"],
                country=event_dict.get("country", ""),
                geo_lat=event_dict.get("geo_lat"),
                geo_lng=event_dict.get("geo_lng"),
                evidence_refs=event_dict.get("evidence_refs", []),
                raw_payload_preview=event_dict.get("raw_payload_preview", ""),
                fact_fields=event_dict.get("fact_fields", {}),
                inference_fields=event_dict.get("inference_fields", {}),
            )
        )

    if not db_events:
        return []

    created_events = GcpSecurityEvent.objects.bulk_create(db_events)

    if publish:
        for event in created_events:
            publish_gcp_security_event(_serialize_event(event))

    if run_rule_engine:
        from monitor.services import gcp_rule_engine

        incident_dicts = gcp_rule_engine.evaluate_events(user, project_id, created_events)
        if incident_dicts:
            new_incidents = gcp_rule_engine.create_incidents(user, project_id, incident_dicts)
            for incident in new_incidents:
                publish_gcp_incident_update(_serialize_incident(incident))

            for incident_dict in incident_dicts:
                if incident_dict["action"] == "updated" and incident_dict.get("incident_id"):
                    try:
                        incident = GcpSecurityIncident.objects.get(id=incident_dict["incident_id"])
                    except GcpSecurityIncident.DoesNotExist:
                        continue
                    publish_gcp_incident_update(_serialize_incident(incident))

    return created_events


def _collect_parsed_events(
    *,
    project_id: str,
    service_account_key_json: str,
    enabled_sources: list[str],
    service_filters: list[str] | None,
    since: datetime,
    max_entries: int,
) -> tuple[list[dict], dict[str, str]]:
    from monitor.services import gcp_event_parser, gcp_log_fetcher

    parsed_events: list[dict] = []
    source_errors: dict[str, str] = {}

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
            entries = fetch_fn(
                service_account_key_json=service_account_key_json,
                project_id=project_id,
                since=since,
                max_entries=max_entries,
                **extra_kwargs,
            )
            for entry in entries:
                parsed = parse_fn(entry, project_id)
                if parsed:
                    parsed_events.append(parsed)
        except Exception as exc:
            logger.exception("Failed to fetch %s logs during collection", source_name)
            source_errors[source_name] = str(exc)

    return parsed_events, source_errors


# ---------------------------------------------------------------------------
# Celery tasks
# ---------------------------------------------------------------------------

@shared_task
def gcp_fetch_logs(user_id: int):
    """Incremental fetch of all enabled GCP log sources."""
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return

    config = _get_gcp_config(user)
    if not config:
        _set_collection_error(user_id, "logs", _NOT_CONFIGURED_MSG)
        return

    log_sources = [
        source
        for source in config["enabled_sources"]
        if source != "cloud_monitoring"
    ]
    since = (
        min(_get_last_fetch_time(user_id, source) for source in log_sources)
        if log_sources
        else datetime.now(timezone.utc) - timedelta(seconds=30)
    )

    parsed_events, source_errors = _collect_parsed_events(
        project_id=config["project_id"],
        service_account_key_json=config["service_account_key_json"],
        enabled_sources=config["enabled_sources"],
        service_filters=config["service_filters"] or None,
        since=since,
        max_entries=500,
    )

    if source_errors:
        for source_name, message in source_errors.items():
            _set_collection_error(user_id, source_name, message)
    else:
        _clear_collection_error(user_id, "logs")

    created_events = _persist_events(
        user=user,
        project_id=config["project_id"],
        event_dicts=parsed_events,
        publish=True,
        run_rule_engine=True,
    )

    if created_events or not source_errors:
        now = datetime.now(timezone.utc)
        for source in ("cloud_run_logs", "load_balancer", "cloud_armor", "iam_audit", "iap"):
            _set_last_fetch_time(user_id, source, now)


@shared_task
def gcp_fetch_metrics(user_id: int):
    """Fetch a current metric snapshot and persist it as a 5-minute sample."""
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return

    config = _get_gcp_config(user)
    if not config:
        _set_collection_error(user_id, "metrics", _NOT_CONFIGURED_MSG)
        return
    if "cloud_monitoring" not in config["enabled_sources"]:
        return

    from monitor.services.gcp_metrics_fetcher import fetch_service_metrics

    try:
        metrics = fetch_service_metrics(
            service_account_key_json=config["service_account_key_json"],
            project_id=config["project_id"],
        )
    except Exception as exc:
        logger.exception("Failed to fetch Cloud Monitoring metrics for user %s", user_id)
        _set_collection_error(user_id, "metrics", str(exc))
        return

    _clear_collection_error(user_id, "metrics")

    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    samples: list[dict] = []
    for service_name, metric in metrics.items():
        GcpObservedService.objects.filter(
            user=user,
            project_id=config["project_id"],
            service_name=service_name,
        ).update(
            request_rate=float(metric.get("request_count", 0) or 0),
            error_rate=0,
            p50_latency_ms=float(metric.get("latency_mean_ms", 0) or 0),
            p95_latency_ms=float(metric.get("latency_p95_ms", 0) or 0),
            instance_count=int(round(metric.get("container_instance_count", 0) or 0)),
        )
        samples.append(
            {
                "service_name": service_name,
                "region": metric.get("region", ""),
                "bucket_end": now,
                "requests": metric.get("request_count", 0),
                "errors": 0,
                "latency_p50_ms": metric.get("latency_mean_ms", 0),
                "latency_p95_ms": metric.get("latency_p95_ms", 0),
                "instances": metric.get("container_instance_count", 0),
                "cpu_utilization": metric.get("container_cpu", 0),
                "memory_utilization": metric.get("container_memory", 0),
                "max_concurrency": metric.get("container_max_concurrency", 0),
            }
        )

    _upsert_health_samples(
        user=user,
        project_id=config["project_id"],
        samples=samples,
        publish=True,
    )


@shared_task
def gcp_fetch_timeseries(user_id: int):
    """Persist and publish aligned 60-minute time-series snapshots."""
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return

    config = _get_gcp_config(user)
    if not config:
        _set_collection_error(user_id, "timeseries", _NOT_CONFIGURED_MSG)
        return
    if "cloud_monitoring" not in config["enabled_sources"]:
        return

    from monitor.services.gcp_metrics_fetcher import fetch_historical_service_health

    try:
        samples = fetch_historical_service_health(
            service_account_key_json=config["service_account_key_json"],
            project_id=config["project_id"],
            minutes_back=60,
            alignment_period_seconds=300,
        )
        _upsert_health_samples(
            user=user,
            project_id=config["project_id"],
            samples=samples,
            publish=False,
        )
        ts_data = [
            {
                "timestamp": sample["bucket_end"],
                "service": sample["service_name"],
                "value": sample.get("requests", 0),
            }
            for sample in samples
        ]
        publish_gcp_timeseries_update(ts_data)
        _clear_collection_error(user_id, "timeseries")
    except Exception as exc:
        logger.exception("Failed to fetch timeseries for user %s", user_id)
        _set_collection_error(user_id, "timeseries", str(exc))


@shared_task
def gcp_discover_services(user_id: int):
    """Auto-discover Cloud Run services and revisions in the project."""
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return

    config = _get_gcp_config(user)
    if not config:
        _set_collection_error(user_id, "discovery", _NOT_CONFIGURED_MSG)
        return

    from monitor.services.gcp_discovery import discover_services

    try:
        services = discover_services(
            service_account_key_json=config["service_account_key_json"],
            project_id=config["project_id"],
            regions=config["regions"] or None,
            service_filters=config["service_filters"] or None,
        )
    except Exception as exc:
        logger.exception("Failed to discover Cloud Run services for user %s", user_id)
        _set_collection_error(user_id, "discovery", str(exc))
        return

    _clear_collection_error(user_id, "discovery")

    for service in services:
        GcpObservedService.objects.update_or_create(
            user=user,
            project_id=config["project_id"],
            service_name=service["service_name"],
            region=service["region"],
            defaults={
                "latest_revision": service.get("latest_revision", ""),
                "url": service.get("url", ""),
                "last_deployed_at": service.get("last_deployed_at"),
            },
        )

    snapshot = _build_estate_snapshot(user, config["project_id"])
    publish_gcp_estate_snapshot(snapshot)


@shared_task
def gcp_backfill_history(user_id: int, days: int = DEFAULT_HISTORY_DAYS):
    """Backfill historical metrics and security events for history mode."""
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return

    config = _get_gcp_config(user)
    if not config:
        _set_history_status(
            user_id,
            {
                "state": "failed",
                "message": _NOT_CONFIGURED_MSG,
            },
        )
        return

    _set_history_status(
        user_id,
        {
            "state": "running",
            "days": days,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "message": f"Backfilling last {days} days of GCP history",
        },
    )

    try:
        from monitor.services.gcp_metrics_fetcher import fetch_historical_service_health

        metrics_samples = fetch_historical_service_health(
            service_account_key_json=config["service_account_key_json"],
            project_id=config["project_id"],
            minutes_back=days * 24 * 60,
            alignment_period_seconds=300,
        )
        _upsert_health_samples(
            user=user,
            project_id=config["project_id"],
            samples=metrics_samples,
            publish=False,
        )

        since = datetime.now(timezone.utc) - timedelta(days=days)
        parsed_events, source_errors = _collect_parsed_events(
            project_id=config["project_id"],
            service_account_key_json=config["service_account_key_json"],
            enabled_sources=config["enabled_sources"],
            service_filters=config["service_filters"] or None,
            since=since,
            max_entries=5000,
        )
        _persist_events(
            user=user,
            project_id=config["project_id"],
            event_dicts=parsed_events,
            publish=False,
            run_rule_engine=False,
        )

        now = datetime.now(timezone.utc)
        for source in ("cloud_run_logs", "load_balancer", "cloud_armor", "iam_audit", "iap"):
            _set_last_fetch_time(user_id, source, now)

        _cleanup_old_data(user, config["project_id"])

        coverage_start, coverage_end = _get_history_coverage(user, config["project_id"])
        _set_history_status(
            user_id,
            {
                "state": "complete" if not source_errors else "partial",
                "days": days,
                "started_at": get_history_status(user_id).get("started_at"),
                "completed_at": now.isoformat(),
                "message": "History backfill complete" if not source_errors else "History backfill completed with partial log source errors",
                "coverage_start": coverage_start.isoformat() if coverage_start else None,
                "coverage_end": coverage_end.isoformat() if coverage_end else None,
                "source_errors": source_errors,
            },
        )
    except Exception as exc:
        logger.exception("Failed to backfill GCP history for user %s", user_id)
        _set_history_status(
            user_id,
            {
                "state": "failed",
                "days": days,
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "message": str(exc),
            },
        )


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------

def _serialize_event(event) -> dict:
    return {
        "id": event.id,
        "source": event.source,
        "timestamp": event.timestamp.isoformat() if isinstance(event.timestamp, datetime) else event.timestamp,
        "project_id": event.project_id,
        "region": event.region,
        "service": event.service,
        "revision": event.revision,
        "severity": event.severity,
        "category": event.category,
        "source_ip": event.source_ip,
        "principal": event.principal,
        "path": event.path,
        "method": event.method,
        "status_code": event.status_code,
        "trace_id": event.trace_id,
        "request_id": event.request_id,
        "country": event.country,
        "geo_lat": event.geo_lat,
        "geo_lng": event.geo_lng,
        "evidence_refs": event.evidence_refs,
        "raw_payload_preview": event.raw_payload_preview,
        "fact_fields": event.fact_fields,
        "inference_fields": event.inference_fields,
        "incident_id": event.incident_id,
    }


def _serialize_incident(incident) -> dict:
    return {
        "id": incident.id,
        "project_id": incident.project_id,
        "incident_type": incident.incident_type,
        "priority": incident.priority,
        "status": incident.status,
        "confidence": incident.confidence,
        "evidence_count": incident.evidence_count,
        "services_affected": incident.services_affected,
        "regions_affected": incident.regions_affected,
        "title": incident.title,
        "narrative": incident.narrative,
        "likely_cause": incident.likely_cause,
        "next_steps": incident.next_steps,
        "ai_inference": incident.ai_inference,
        "first_seen": incident.first_seen.isoformat() if isinstance(incident.first_seen, datetime) else incident.first_seen,
        "last_seen": incident.last_seen.isoformat() if isinstance(incident.last_seen, datetime) else incident.last_seen,
        "acknowledged_by": incident.acknowledged_by,
        "acknowledged_at": incident.acknowledged_at.isoformat() if incident.acknowledged_at else None,
        "created_at": incident.created_at.isoformat() if isinstance(incident.created_at, datetime) else incident.created_at,
        "updated_at": incident.updated_at.isoformat() if isinstance(incident.updated_at, datetime) else incident.updated_at,
    }


def _serialize_health(health) -> dict:
    return {
        "id": health.id,
        "project_id": health.project_id,
        "service_name": health.service_name,
        "region": health.region,
        "request_count": health.request_count,
        "error_count": health.error_count,
        "latency_p50_ms": health.latency_p50_ms,
        "latency_p95_ms": health.latency_p95_ms,
        "latency_p99_ms": health.latency_p99_ms,
        "instance_count": health.instance_count,
        "max_concurrency": health.max_concurrency,
        "cpu_utilization": health.cpu_utilization,
        "memory_utilization": health.memory_utilization,
        "bucket_start": health.bucket_start.isoformat(),
        "bucket_end": health.bucket_end.isoformat(),
    }


def _build_estate_snapshot(user, project_id: str) -> dict:
    services = GcpObservedService.objects.filter(
        user=user,
        project_id=project_id,
    )

    open_incidents = GcpSecurityIncident.objects.filter(
        user=user,
        project_id=project_id,
        status__in=["open", "investigating"],
    ).count()

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
    recent_events = GcpSecurityEvent.objects.filter(
        user=user,
        project_id=project_id,
        timestamp__gte=cutoff,
    )

    history_meta = get_history_metadata(user, project_id)

    return {
        "project_id": project_id,
        "active_incidents": open_incidents,
        "services_under_attack": recent_events.filter(severity__in=["high", "critical"]).values("service").distinct().count(),
        "total_services": services.count(),
        "coverage_start": history_meta["coverage_start"],
        "coverage_end": history_meta["coverage_end"],
        "history_ready": history_meta["history_ready"],
        "backfill_status": history_meta["backfill_status"],
        "services": [
            {
                "service_name": service.service_name,
                "region": service.region,
                "latest_revision": service.latest_revision,
                "instance_count": service.instance_count,
                "url": service.url,
                "risk_score": service.risk_score,
                "risk_tags": service.risk_tags,
                "request_rate": service.request_rate,
                "error_rate": service.error_rate,
                "p50_latency_ms": service.p50_latency_ms,
                "p95_latency_ms": service.p95_latency_ms,
                "p99_latency_ms": service.p99_latency_ms,
            }
            for service in services
        ],
    }
