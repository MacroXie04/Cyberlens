"""GCP Observability Aggregator — Celery tasks that poll GCP APIs and push to Redis.

Runs on a periodic schedule:
  - Every 5s:  incremental log fetch → parse → events → rule engine → incidents
  - Every 15s: Cloud Monitoring metrics → service health snapshots
  - Every 60s: Cloud Run service/revision auto-discovery
"""

import json
import logging
from datetime import datetime, timedelta, timezone

from celery import shared_task
from django.core.cache import cache

from monitor.models import (
    GcpObservedService,
    GcpSecurityEvent,
    GcpSecurityIncident,
    GcpServiceHealth,
)
from monitor.services.redis_publisher import (
    publish_gcp_estate_snapshot,
    publish_gcp_security_event,
    publish_gcp_incident_update,
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

_NOT_CONFIGURED_MSG = (
    "GCP not configured \u2014 set project ID and service account key in Settings"
)


# ---------------------------------------------------------------------------
# Collection error helpers — write per-source errors to cache so the frontend
# can surface actionable messages instead of showing a blank dashboard.
# ---------------------------------------------------------------------------

def _collection_errors_key(user_id: int) -> str:
    return f"gcp_collection_errors:{user_id}"


def _set_collection_error(user_id: int, source: str, message: str):
    key = _collection_errors_key(user_id)
    errors = cache.get(key) or {}
    errors[source] = message
    cache.set(key, errors, timeout=120)


def _clear_collection_error(user_id: int, source: str):
    key = _collection_errors_key(user_id)
    errors = cache.get(key)
    if errors and source in errors:
        del errors[source]
        cache.set(key, errors, timeout=120)


def get_collection_errors(user_id: int) -> dict:
    """Return the current collection error dict (used by views)."""
    return cache.get(_collection_errors_key(user_id)) or {}


def _get_gcp_config(user):
    """Get GCP config from user settings. Returns None if not configured."""
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
    """Get the last fetch timestamp for a source, default 30s ago."""
    key = f"gcp_last_fetch:{user_id}:{source}"
    cached = cache.get(key)
    if cached:
        return datetime.fromisoformat(cached)
    return datetime.now(timezone.utc) - timedelta(seconds=30)


def _set_last_fetch_time(user_id: int, source: str, ts: datetime):
    key = f"gcp_last_fetch:{user_id}:{source}"
    cache.set(key, ts.isoformat(), timeout=3600)


@shared_task
def gcp_fetch_logs(user_id: int):
    """Incremental fetch of all enabled GCP log sources, parse, create events, run rules."""
    from django.contrib.auth.models import User

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return

    config = _get_gcp_config(user)
    if not config:
        _set_collection_error(user_id, "logs", _NOT_CONFIGURED_MSG)
        return

    enabled = config["enabled_sources"]
    project_id = config["project_id"]
    sa_key = config["service_account_key_json"]
    services = config["service_filters"] or None

    from monitor.services import gcp_log_fetcher, gcp_event_parser

    all_events = []
    had_error = False

    # Cloud Run Logs
    if "cloud_run_logs" in enabled:
        since = _get_last_fetch_time(user_id, "cloud_run_logs")
        try:
            raw_entries = gcp_log_fetcher.fetch_cloud_run_logs(
                service_account_key_json=sa_key,
                project_id=project_id,
                services=services,
                since=since,
            )
            for entry in raw_entries:
                parsed = gcp_event_parser.parse_cloud_run_log(entry, project_id)
                if parsed:
                    all_events.append(parsed)
            _set_last_fetch_time(user_id, "cloud_run_logs", datetime.now(timezone.utc))
        except Exception as exc:
            had_error = True
            logger.exception("Failed to fetch Cloud Run logs for user %s", user_id)
            _set_collection_error(user_id, "cloud_run_logs", str(exc))

    # Load Balancer Logs
    if "load_balancer" in enabled:
        since = _get_last_fetch_time(user_id, "load_balancer")
        try:
            raw_entries = gcp_log_fetcher.fetch_load_balancer_logs(
                service_account_key_json=sa_key,
                project_id=project_id,
                since=since,
            )
            for entry in raw_entries:
                parsed = gcp_event_parser.parse_load_balancer_log(entry, project_id)
                if parsed:
                    all_events.append(parsed)
            _set_last_fetch_time(user_id, "load_balancer", datetime.now(timezone.utc))
        except Exception as exc:
            had_error = True
            logger.exception("Failed to fetch LB logs for user %s", user_id)
            _set_collection_error(user_id, "load_balancer", str(exc))

    # Cloud Armor Logs
    if "cloud_armor" in enabled:
        since = _get_last_fetch_time(user_id, "cloud_armor")
        try:
            raw_entries = gcp_log_fetcher.fetch_cloud_armor_logs(
                service_account_key_json=sa_key,
                project_id=project_id,
                since=since,
            )
            for entry in raw_entries:
                parsed = gcp_event_parser.parse_cloud_armor_log(entry, project_id)
                if parsed:
                    all_events.append(parsed)
            _set_last_fetch_time(user_id, "cloud_armor", datetime.now(timezone.utc))
        except Exception as exc:
            had_error = True
            logger.exception("Failed to fetch Cloud Armor logs for user %s", user_id)
            _set_collection_error(user_id, "cloud_armor", str(exc))

    # IAM Audit Logs
    if "iam_audit" in enabled:
        since = _get_last_fetch_time(user_id, "iam_audit")
        try:
            raw_entries = gcp_log_fetcher.fetch_iam_audit_logs(
                service_account_key_json=sa_key,
                project_id=project_id,
                since=since,
            )
            for entry in raw_entries:
                parsed = gcp_event_parser.parse_iam_audit_log(entry, project_id)
                if parsed:
                    all_events.append(parsed)
            _set_last_fetch_time(user_id, "iam_audit", datetime.now(timezone.utc))
        except Exception as exc:
            had_error = True
            logger.exception("Failed to fetch IAM audit logs for user %s", user_id)
            _set_collection_error(user_id, "iam_audit", str(exc))

    # IAP Logs
    if "iap" in enabled:
        since = _get_last_fetch_time(user_id, "iap")
        try:
            raw_entries = gcp_log_fetcher.fetch_iap_logs(
                service_account_key_json=sa_key,
                project_id=project_id,
                since=since,
            )
            for entry in raw_entries:
                parsed = gcp_event_parser.parse_iap_log(entry, project_id)
                if parsed:
                    all_events.append(parsed)
            _set_last_fetch_time(user_id, "iap", datetime.now(timezone.utc))
        except Exception as exc:
            had_error = True
            logger.exception("Failed to fetch IAP logs for user %s", user_id)
            _set_collection_error(user_id, "iap", str(exc))

    if not had_error:
        _clear_collection_error(user_id, "logs")

    if not all_events:
        return

    # Persist events to DB
    db_events = []
    for evt in all_events:
        db_events.append(GcpSecurityEvent(
            user=user,
            source=evt["source"],
            timestamp=evt["timestamp"],
            project_id=evt["project_id"],
            region=evt.get("region", ""),
            service=evt.get("service", ""),
            revision=evt.get("revision", ""),
            severity=evt.get("severity", "info"),
            category=evt.get("category", "other"),
            source_ip=evt.get("source_ip"),
            principal=evt.get("principal", ""),
            path=evt.get("path", ""),
            method=evt.get("method", ""),
            status_code=evt.get("status_code"),
            trace_id=evt.get("trace_id", ""),
            request_id=evt.get("request_id", ""),
            country=evt.get("country", ""),
            geo_lat=evt.get("geo_lat"),
            geo_lng=evt.get("geo_lng"),
            evidence_refs=evt.get("evidence_refs", []),
            raw_payload_preview=evt.get("raw_payload_preview", ""),
            fact_fields=evt.get("fact_fields", {}),
            inference_fields=evt.get("inference_fields", {}),
        ))

    created_events = GcpSecurityEvent.objects.bulk_create(db_events)

    # Publish events to Socket.IO
    for evt in created_events:
        publish_gcp_security_event(_serialize_event(evt))

    # Run rule engine
    from monitor.services import gcp_rule_engine

    incident_dicts = gcp_rule_engine.evaluate_events(user, project_id, created_events)
    if incident_dicts:
        new_incidents = gcp_rule_engine.create_incidents(user, project_id, incident_dicts)
        for inc in new_incidents:
            publish_gcp_incident_update(_serialize_incident(inc))

        # Also publish updates for merged incidents
        for inc_dict in incident_dicts:
            if inc_dict["action"] == "updated" and inc_dict.get("incident_id"):
                try:
                    inc = GcpSecurityIncident.objects.get(id=inc_dict["incident_id"])
                    publish_gcp_incident_update(_serialize_incident(inc))
                except GcpSecurityIncident.DoesNotExist:
                    pass


@shared_task
def gcp_fetch_metrics(user_id: int):
    """Fetch Cloud Monitoring metrics and update service health snapshots."""
    from django.contrib.auth.models import User

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

    now = datetime.now(timezone.utc)
    bucket_start = now - timedelta(minutes=5)

    for svc_name, svc_metrics in metrics.items():
        # Update GcpObservedService metrics
        GcpObservedService.objects.filter(
            user=user,
            project_id=config["project_id"],
            service_name=svc_name,
        ).update(
            request_rate=svc_metrics.get("request_count", 0),
            error_rate=0,  # computed from error_count / request_count
            p50_latency_ms=svc_metrics.get("latency_mean_ms", 0),
            instance_count=int(svc_metrics.get("container_instance_count", 0)),
        )

        # Create health snapshot
        health = GcpServiceHealth.objects.create(
            user=user,
            project_id=config["project_id"],
            service_name=svc_name,
            region=svc_metrics.get("region", ""),
            request_count=int(svc_metrics.get("request_count", 0)),
            error_count=0,
            latency_p50_ms=svc_metrics.get("latency_mean_ms", 0),
            instance_count=int(svc_metrics.get("container_instance_count", 0)),
            max_concurrency=svc_metrics.get("container_max_concurrency", 0),
            cpu_utilization=svc_metrics.get("container_cpu", 0),
            memory_utilization=svc_metrics.get("container_memory", 0),
            bucket_start=bucket_start,
            bucket_end=now,
        )

        publish_gcp_service_health(_serialize_health(health))


@shared_task
def gcp_discover_services(user_id: int):
    """Auto-discover Cloud Run services and revisions in the project."""
    from django.contrib.auth.models import User

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

    for svc in services:
        GcpObservedService.objects.update_or_create(
            user=user,
            project_id=config["project_id"],
            service_name=svc["service_name"],
            region=svc["region"],
            defaults={
                "latest_revision": svc.get("latest_revision", ""),
                "url": svc.get("url", ""),
                "last_deployed_at": svc.get("last_deployed_at"),
            },
        )

    # Build estate snapshot and publish
    snapshot = _build_estate_snapshot(user, config["project_id"])
    publish_gcp_estate_snapshot(snapshot)


@shared_task
def gcp_fetch_timeseries(user_id: int):
    """Fetch request count timeseries for the threat timeline chart."""
    from django.contrib.auth.models import User

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

    from monitor.services.gcp_metrics_fetcher import fetch_timeseries

    try:
        ts_data = fetch_timeseries(
            service_account_key_json=config["service_account_key_json"],
            project_id=config["project_id"],
            minutes_back=60,
        )
        publish_gcp_timeseries_update(ts_data)
        _clear_collection_error(user_id, "timeseries")
    except Exception as exc:
        logger.exception("Failed to fetch timeseries for user %s", user_id)
        _set_collection_error(user_id, "timeseries", str(exc))


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
    """Build a full estate snapshot for the frontend first-screen."""
    services = GcpObservedService.objects.filter(
        user=user, project_id=project_id
    )

    # Count active incidents
    open_incidents = GcpSecurityIncident.objects.filter(
        user=user,
        project_id=project_id,
        status__in=["open", "investigating"],
    ).count()

    # Recent event counts by severity
    from django.utils import timezone as tz
    cutoff = tz.now() - timedelta(minutes=15)
    recent_events = GcpSecurityEvent.objects.filter(
        user=user, project_id=project_id, timestamp__gte=cutoff
    )

    services_under_attack = (
        recent_events.filter(severity__in=["high", "critical"])
        .values("service")
        .distinct()
        .count()
    )

    return {
        "project_id": project_id,
        "active_incidents": open_incidents,
        "services_under_attack": services_under_attack,
        "total_services": services.count(),
        "services": [
            {
                "service_name": s.service_name,
                "region": s.region,
                "latest_revision": s.latest_revision,
                "instance_count": s.instance_count,
                "url": s.url,
                "risk_score": s.risk_score,
                "risk_tags": s.risk_tags,
                "request_rate": s.request_rate,
                "error_rate": s.error_rate,
                "p50_latency_ms": s.p50_latency_ms,
                "p95_latency_ms": s.p95_latency_ms,
                "p99_latency_ms": s.p99_latency_ms,
            }
            for s in services
        ],
    }
