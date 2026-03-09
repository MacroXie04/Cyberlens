from datetime import datetime, timedelta, timezone

from monitor.models import GcpObservedService, GcpSecurityEvent, GcpSecurityIncident

from .history import get_history_metadata


def build_estate_snapshot(user, project_id: str) -> dict:
    services = GcpObservedService.objects.filter(user=user, project_id=project_id)
    active_incidents = GcpSecurityIncident.objects.filter(user=user, project_id=project_id, status__in=["open", "investigating"]).count()
    recent_events = GcpSecurityEvent.objects.filter(user=user, project_id=project_id, timestamp__gte=datetime.now(timezone.utc) - timedelta(minutes=15))
    history = get_history_metadata(user, project_id)
    return {
        "project_id": project_id,
        "active_incidents": active_incidents,
        "services_under_attack": recent_events.filter(severity__in=["high", "critical"]).values("service").distinct().count(),
        "total_services": services.count(),
        "coverage_start": history["coverage_start"],
        "coverage_end": history["coverage_end"],
        "history_ready": history["history_ready"],
        "backfill_status": history["backfill_status"],
        "services": [{"service_name": service.service_name, "region": service.region, "latest_revision": service.latest_revision, "instance_count": service.instance_count, "url": service.url, "risk_score": service.risk_score, "risk_tags": service.risk_tags, "request_rate": service.request_rate, "error_rate": service.error_rate, "p50_latency_ms": service.p50_latency_ms, "p95_latency_ms": service.p95_latency_ms, "p99_latency_ms": service.p99_latency_ms} for service in services],
    }
