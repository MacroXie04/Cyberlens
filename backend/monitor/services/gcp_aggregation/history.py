from django.db.models import Max, Min

from monitor.models import GcpSecurityEvent, GcpSecurityIncident, GcpServiceHealth

from .status_cache import get_history_status


def get_history_coverage(user, project_id: str):
    health = GcpServiceHealth.objects.filter(user=user, project_id=project_id).aggregate(min_ts=Min("bucket_end"), max_ts=Max("bucket_end"))
    events = GcpSecurityEvent.objects.filter(user=user, project_id=project_id).aggregate(min_ts=Min("timestamp"), max_ts=Max("timestamp"))
    incidents = GcpSecurityIncident.objects.filter(user=user, project_id=project_id).aggregate(min_ts=Min("first_seen"), max_ts=Max("last_seen"))
    starts = [value for value in (health["min_ts"], events["min_ts"], incidents["min_ts"]) if value is not None]
    ends = [value for value in (health["max_ts"], events["max_ts"], incidents["max_ts"]) if value is not None]
    return (min(starts) if starts else None, max(ends) if ends else None)


def get_history_metadata(user, project_id: str) -> dict:
    coverage_start, coverage_end = get_history_coverage(user, project_id)
    status = get_history_status(user.id)
    return {"coverage_start": coverage_start.isoformat() if coverage_start else None, "coverage_end": coverage_end.isoformat() if coverage_end else None, "history_ready": bool(coverage_start or coverage_end), "backfill_status": status}
