from django.db.models import Count, Q

from monitor.models import GcpObservedService, GcpSecurityEvent, GcpSecurityIncident, GcpServiceHealth
from monitor.serializers import GcpSecurityEventSerializer, GcpSecurityIncidentSerializer, GcpServiceHealthSerializer

from .gcp_helpers import apply_event_filters, apply_service_filters, history_metadata, service_error_rate, service_total


def build_summary_payload(user, project_id: str, start, end, services=None):
    event_qs = GcpSecurityEvent.objects.filter(
        user=user,
        project_id=project_id,
        timestamp__gte=start,
        timestamp__lte=end,
    )
    incident_qs = GcpSecurityIncident.objects.filter(
        user=user,
        project_id=project_id,
        first_seen__lte=end,
        last_seen__gte=start,
        status__in=["open", "investigating"],
    )
    if services is None:
        services = GcpObservedService.objects.filter(user=user, project_id=project_id)

    from monitor.services.gcp_aggregator import get_collection_errors

    summary = {
        "project_id": project_id,
        "active_incidents": incident_qs.count(),
        "services_under_attack": event_qs.filter(severity__in=["high", "critical"]).exclude(service="").values("service").distinct().count(),
        "armor_blocks_recent": event_qs.filter(category="armor_block").count(),
        "auth_failures_recent": event_qs.filter(category__in=["iap_auth_failure", "credential_abuse"]).count(),
        "error_events_recent": event_qs.filter(category="error_surge").count(),
        "total_events_recent": event_qs.count(),
        "total_services": service_total(services),
        "unhealthy_revisions": sum(1 for service in services if service_error_rate(service) > 0.05),
        "collection_errors": get_collection_errors(user.id),
    }
    summary.update(history_metadata(user, project_id))
    return summary


def service_snapshot(user, project_id: str, cursor, request):
    observed_services = list(
        apply_service_filters(
            GcpObservedService.objects.filter(user=user, project_id=project_id),
            request,
        )
    )
    latest_health = {}
    health_rows = apply_service_filters(
        GcpServiceHealth.objects.filter(
            user=user,
            project_id=project_id,
            bucket_end__lte=cursor,
        ).order_by("service_name", "region", "-bucket_end"),
        request,
    )
    for row in health_rows:
        latest_health.setdefault((row.service_name, row.region), row)

    snapshot = []
    for service in observed_services:
        health = latest_health.get((service.service_name, service.region))
        request_count = float((health.request_count if health else service.request_rate) or 0)
        if health and health.request_count:
            error_rate = float(health.error_count or 0) / float(health.request_count or 1)
        else:
            error_rate = float((service.error_rate if not health else 0) or 0)
        snapshot.append(
            {
                "id": service.id,
                "project_id": service.project_id,
                "service_name": service.service_name,
                "region": service.region,
                "latest_revision": service.latest_revision,
                "instance_count": health.instance_count if health else service.instance_count,
                "url": service.url,
                "last_deployed_at": service.last_deployed_at,
                "risk_score": service.risk_score,
                "risk_tags": service.risk_tags,
                "request_rate": request_count,
                "error_rate": error_rate,
                "p50_latency_ms": float((health.latency_p50_ms if health else service.p50_latency_ms) or 0),
                "p95_latency_ms": float((health.latency_p95_ms if health else service.p95_latency_ms) or 0),
                "p99_latency_ms": float((health.latency_p99_ms if health else service.p99_latency_ms) or 0),
                "updated_at": (health.bucket_end if health else service.updated_at).isoformat(),
                "sample_missing": health is None,
            }
        )
    return snapshot


def replay_snapshot_payload(user, project_id, cursor, window_minutes: int, request):
    from datetime import timedelta

    window_start = cursor - timedelta(minutes=window_minutes)
    events_qs = apply_event_filters(
        GcpSecurityEvent.objects.filter(
            user=user,
            project_id=project_id,
            timestamp__gte=window_start,
            timestamp__lte=cursor,
        ).order_by("-timestamp"),
        request,
    )
    events = list(events_qs[:200])
    incidents = []
    for incident in GcpSecurityIncident.objects.filter(
        user=user,
        project_id=project_id,
        first_seen__lte=cursor,
        last_seen__gte=window_start,
    ).order_by("-last_seen")[:100]:
        if request.query_params.get("service") and request.query_params.get("service") not in (incident.services_affected or []):
            continue
        if request.query_params.get("region") and request.query_params.get("region") not in (incident.regions_affected or []):
            continue
        incidents.append(incident)

    services = service_snapshot(user, project_id, cursor, request)
    summary = build_summary_payload(user, project_id, window_start, cursor, services=services)
    geo = list(
        events_qs.filter(source_ip__isnull=False, severity__in=["medium", "high", "critical"])
        .exclude(country="")
        .values("country", "geo_lat", "geo_lng")
        .annotate(count=Count("id"), critical=Count("id", filter=Q(severity="critical")), high=Count("id", filter=Q(severity="high")))
        .order_by("-count")
    )
    return {
        "cursor": cursor.isoformat(),
        "window_start": window_start.isoformat(),
        "window_end": cursor.isoformat(),
        "summary": summary,
        "services": services,
        "map": geo,
        "perimeter": {source: sum(1 for event in events if event.source == source) for source in ("cloud_armor", "load_balancer", "iam_audit", "iap")},
        "events": GcpSecurityEventSerializer(events, many=True).data,
        "incidents": GcpSecurityIncidentSerializer(incidents, many=True).data,
        "history_status": history_metadata(user, project_id),
    }


def estate_timeseries_response(user, project_id, start, end, request):
    queryset = apply_service_filters(
        GcpServiceHealth.objects.filter(
            user=user,
            project_id=project_id,
            bucket_end__gte=start,
            bucket_end__lte=end,
        ).order_by("bucket_end")[:5000],
        request,
    )
    return GcpServiceHealthSerializer(queryset, many=True).data
