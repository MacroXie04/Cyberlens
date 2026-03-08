import logging
from datetime import datetime, timedelta, timezone

from django.core.cache import cache
from django.db.models import Count, Q
from django.db.models.functions import TruncHour
from django.utils import timezone as tz
from django.utils.dateparse import parse_datetime
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import (
    Alert,
    AnalysisResult,
    GcpObservedService,
    GcpSecurityEvent,
    GcpSecurityIncident,
    GcpServiceHealth,
    HttpRequest,
)
from .serializers import (
    AlertSerializer,
    GcpObservedServiceSerializer,
    GcpSecurityEventSerializer,
    GcpSecurityIncidentDetailSerializer,
    GcpSecurityIncidentSerializer,
    GcpServiceHealthSerializer,
    HttpRequestSerializer,
)

logger = logging.getLogger(__name__)


class HttpRequestViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HttpRequest.objects.select_related("analysis").all()
    serializer_class = HttpRequestSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        threat_level = self.request.query_params.get("threat_level")
        if threat_level:
            qs = qs.filter(analysis__threat_level=threat_level)
        return qs


class AlertViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Alert.objects.all()
    serializer_class = AlertSerializer

    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        alert = self.get_object()
        alert.acknowledged = True
        alert.save()
        return Response({"status": "acknowledged"})


@api_view(["GET"])
def stats_overview(request):
    total = HttpRequest.objects.count()
    analyzed = AnalysisResult.objects.count()
    threats = AnalysisResult.objects.exclude(threat_level="safe").count()
    malicious = AnalysisResult.objects.filter(threat_level="malicious").count()
    return Response(
        {
            "total_requests": total,
            "ai_analyzed": analyzed,
            "threats_detected": threats,
            "malicious_count": malicious,
        }
    )


@api_view(["GET"])
def stats_timeline(request):
    data = (
        HttpRequest.objects.annotate(hour=TruncHour("timestamp"))
        .values("hour")
        .annotate(
            total=Count("id"),
            threats=Count(
                "id",
                filter=Q(analysis__threat_level__in=["suspicious", "malicious"]),
            ),
        )
        .order_by("hour")
    )
    return Response(list(data))


@api_view(["GET"])
def verify_session(request):
    if request.user.is_authenticated:
        return Response({"status": "authenticated"})
    return Response({"error": "unauthenticated"}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(["GET"])
def cloud_run_logs(request):
    from accounts.models import UserSettings

    user_settings, _ = UserSettings.objects.get_or_create(user=request.user)

    if not all(
        [
            user_settings.gcp_project_id,
            user_settings.gcp_service_name,
            user_settings.gcp_service_account_key,
        ]
    ):
        return Response(
            {
                "error": "GCP Cloud Logging not configured. Set project ID, service name, and service account key in Settings."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    from .services.cloud_logging import fetch_cloud_run_logs

    max_entries = max(1, min(int(request.query_params.get("limit", 100)), 500))
    hours_back = max(1, min(int(request.query_params.get("hours", 1)), 720))
    severity = request.query_params.get("severity")
    text_filter = request.query_params.get("q")
    page_token = request.query_params.get("page_token")

    try:
        result = fetch_cloud_run_logs(
            service_account_key_json=user_settings.gcp_service_account_key,
            project_id=user_settings.gcp_project_id,
            service_name=user_settings.gcp_service_name,
            max_entries=max_entries,
            hours_back=hours_back,
            severity=severity,
            text_filter=text_filter,
            page_token=page_token,
        )
        return Response(result)
    except Exception as exc:
        logger.exception("Failed to fetch Cloud Run logs")
        return Response(
            {"error": f"Failed to fetch logs: {str(exc)}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )


@api_view(["GET"])
def stats_geo(request):
    data = (
        HttpRequest.objects.exclude(geo_country="")
        .values("geo_country", "geo_lat", "geo_lng")
        .annotate(
            count=Count("id"),
            threats=Count(
                "id",
                filter=Q(analysis__threat_level__in=["suspicious", "malicious"]),
            ),
        )
        .order_by("-threats")
    )
    return Response(list(data))


# ---------------------------------------------------------------------------
# GCP Estate & Security Endpoints
# ---------------------------------------------------------------------------

def _get_user_project_id(request):
    project_id = request.query_params.get("project_id")
    if project_id:
        return project_id

    from accounts.models import UserSettings

    try:
        settings = UserSettings.objects.get(user=request.user)
        return settings.gcp_project_id
    except UserSettings.DoesNotExist:
        return None


def _parse_minutes(request, default: int = 15) -> int:
    minutes = int(request.query_params.get("minutes", default))
    return max(1, min(minutes, 43200))


def _parse_dt_param(name: str, value: str | None):
    if not value:
        return None
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    parsed = parse_datetime(value)
    if parsed is None:
        raise ValueError(f"Invalid {name}")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _parse_window(request, default_minutes: int = 15):
    start = _parse_dt_param("start", request.query_params.get("start"))
    end = _parse_dt_param("end", request.query_params.get("end"))
    if start and end:
        if start >= end:
            raise ValueError("start must be before end")
        return start, end

    minutes = _parse_minutes(request, default_minutes)
    end = tz.now()
    return end - timedelta(minutes=minutes), end


def _parse_cursor(request, default_end):
    return _parse_dt_param("cursor", request.query_params.get("cursor")) or default_end


def _apply_event_filters(qs, request):
    if region := request.query_params.get("region"):
        qs = qs.filter(region=region)
    if severity := request.query_params.get("severity"):
        qs = qs.filter(severity=severity)
    if category := request.query_params.get("category"):
        qs = qs.filter(category=category)
    if source := request.query_params.get("source"):
        qs = qs.filter(source=source)
    if service := request.query_params.get("service"):
        qs = qs.filter(service=service)
    return qs


def _apply_service_filters(qs, request):
    if region := request.query_params.get("region"):
        qs = qs.filter(region=region)
    if service := request.query_params.get("service"):
        qs = qs.filter(service_name=service)
    return qs


def _history_metadata(user, project_id):
    from monitor.services.gcp_aggregator import get_history_metadata

    return get_history_metadata(user, project_id)


def _service_total(services):
    if isinstance(services, (list, tuple)):
        return len(services)
    return services.count()


def _service_error_rate(service) -> float:
    if isinstance(service, dict):
        return float(service.get("error_rate", 0) or 0)
    return float(getattr(service, "error_rate", 0) or 0)


def _build_summary_payload(user, project_id: str, start, end, services=None):
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

    summary = {
        "project_id": project_id,
        "active_incidents": incident_qs.count(),
        "services_under_attack": event_qs.filter(severity__in=["high", "critical"]).exclude(service="").values("service").distinct().count(),
        "armor_blocks_recent": event_qs.filter(category="armor_block").count(),
        "auth_failures_recent": event_qs.filter(category__in=["iap_auth_failure", "credential_abuse"]).count(),
        "error_events_recent": event_qs.filter(category="error_surge").count(),
        "total_events_recent": event_qs.count(),
        "total_services": _service_total(services),
        "unhealthy_revisions": sum(1 for service in services if _service_error_rate(service) > 0.05),
    }
    summary.update(_history_metadata(user, project_id))
    from monitor.services.gcp_aggregator import get_collection_errors

    summary["collection_errors"] = get_collection_errors(user.id)
    return summary


def _service_snapshot(user, project_id: str, cursor, request):
    observed_services = list(
        _apply_service_filters(
            GcpObservedService.objects.filter(user=user, project_id=project_id),
            request,
        )
    )

    latest_health = {}
    health_rows = _apply_service_filters(
        GcpServiceHealth.objects.filter(
            user=user,
            project_id=project_id,
            bucket_end__lte=cursor,
        ).order_by("service_name", "region", "-bucket_end"),
        request,
    )
    for row in health_rows:
        key = (row.service_name, row.region)
        if key not in latest_health:
            latest_health[key] = row

    snapshot = []
    for service in observed_services:
        health = latest_health.get((service.service_name, service.region))
        request_count = float((health.request_count if health else service.request_rate) or 0)
        error_rate = 0.0
        if health and health.request_count:
            error_rate = float(health.error_count or 0) / float(health.request_count or 1)
        elif not health:
            error_rate = float(service.error_rate or 0)

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


def _bucket_seconds(bucket: str) -> int:
    return {
        "5m": 300,
        "1h": 3600,
        "6h": 21600,
    }.get(bucket, 21600)


def _floor_bucket(dt_value, bucket_seconds: int):
    epoch = int(dt_value.timestamp())
    return datetime.fromtimestamp(epoch - (epoch % bucket_seconds), tz=timezone.utc)


def _timeline_markers(user, project_id, start, end):
    markers = [
        {
            "id": f"incident-{incident.id}",
            "kind": "incident",
            "ts": incident.last_seen.isoformat(),
            "severity": incident.priority,
            "title": incident.title,
        }
        for incident in GcpSecurityIncident.objects.filter(
            user=user,
            project_id=project_id,
            first_seen__lte=end,
            last_seen__gte=start,
        )[:100]
    ]
    markers.extend(
        {
            "id": f"event-{event.id}",
            "kind": "event",
            "ts": event.timestamp.isoformat(),
            "severity": event.severity,
            "title": event.category.replace("_", " "),
        }
        for event in GcpSecurityEvent.objects.filter(
            user=user,
            project_id=project_id,
            timestamp__gte=start,
            timestamp__lte=end,
            severity__in=["high", "critical"],
        ).order_by("-timestamp")[:120]
    )
    return sorted(markers, key=lambda marker: marker["ts"])


def _timeline_payload(user, project_id, start, end, bucket: str, request):
    bucket_seconds = _bucket_seconds(bucket)
    rows = _apply_service_filters(
        GcpServiceHealth.objects.filter(
            user=user,
            project_id=project_id,
            bucket_end__gte=start,
            bucket_end__lte=end,
        ),
        request,
    )

    points = {}
    cursor = _floor_bucket(start, bucket_seconds)
    while cursor <= end:
        key = cursor.isoformat()
        points[key] = {
            "ts": key,
            "requests": 0,
            "errors": 0,
            "incident_count": 0,
        }
        cursor += timedelta(seconds=bucket_seconds)

    for row in rows:
        key = _floor_bucket(row.bucket_end, bucket_seconds).isoformat()
        point = points.setdefault(
            key,
            {"ts": key, "requests": 0, "errors": 0, "incident_count": 0},
        )
        point["requests"] += row.request_count
        point["errors"] += row.error_count

    markers = _timeline_markers(user, project_id, start, end)
    for marker in markers:
        marker_dt = _parse_dt_param("marker", marker["ts"])
        if marker_dt is None or marker["kind"] != "incident":
            continue
        key = _floor_bucket(marker_dt, bucket_seconds).isoformat()
        if key in points:
            points[key]["incident_count"] += 1

    payload = {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "bucket": bucket,
        "points": [points[key] for key in sorted(points.keys())],
        "markers": markers,
    }
    payload.update(_history_metadata(user, project_id))
    return payload


def _replay_snapshot_payload(user, project_id, cursor, window_minutes: int, request):
    window_start = cursor - timedelta(minutes=window_minutes)
    events_qs = _apply_event_filters(
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
        selected_service = request.query_params.get("service")
        selected_region = request.query_params.get("region")
        if selected_service and selected_service not in (incident.services_affected or []):
            continue
        if selected_region and selected_region not in (incident.regions_affected or []):
            continue
        incidents.append(incident)

    services = _service_snapshot(user, project_id, cursor, request)
    summary = _build_summary_payload(user, project_id, window_start, cursor, services=services)

    geo = list(
        events_qs.filter(
            source_ip__isnull=False,
            severity__in=["medium", "high", "critical"],
        )
        .exclude(country="")
        .values("country", "geo_lat", "geo_lng")
        .annotate(
            count=Count("id"),
            critical=Count("id", filter=Q(severity="critical")),
            high=Count("id", filter=Q(severity="high")),
        )
        .order_by("-count")
    )

    perimeter = {
        source: sum(1 for event in events if event.source == source)
        for source in ("cloud_armor", "load_balancer", "iam_audit", "iap")
    }

    return {
        "cursor": cursor.isoformat(),
        "window_start": window_start.isoformat(),
        "window_end": cursor.isoformat(),
        "summary": summary,
        "services": services,
        "map": geo,
        "perimeter": perimeter,
        "events": GcpSecurityEventSerializer(events, many=True).data,
        "incidents": GcpSecurityIncidentSerializer(incidents, many=True).data,
        "history_status": _history_metadata(user, project_id),
    }


@api_view(["GET"])
def gcp_estate_summary(request):
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"error": "GCP project not configured"}, status=400)

    start, end = _parse_window(request, default_minutes=15)
    services = _apply_service_filters(
        GcpObservedService.objects.filter(user=request.user, project_id=project_id),
        request,
    )
    return Response(_build_summary_payload(request.user, project_id, start, end, services=services))


@api_view(["GET"])
def gcp_estate_services(request):
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"error": "GCP project not configured"}, status=400)

    cursor = _parse_cursor(request, tz.now())
    return Response(_service_snapshot(request.user, project_id, cursor, request))


@api_view(["GET"])
def gcp_estate_timeseries(request):
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"error": "GCP project not configured"}, status=400)

    start, end = _parse_window(request, default_minutes=15)
    qs = _apply_service_filters(
        GcpServiceHealth.objects.filter(
            user=request.user,
            project_id=project_id,
            bucket_end__gte=start,
            bucket_end__lte=end,
        ).order_by("bucket_end")[:5000],
        request,
    )
    return Response(GcpServiceHealthSerializer(qs, many=True).data)


@api_view(["GET"])
def gcp_estate_timeline(request):
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"error": "GCP project not configured"}, status=400)

    try:
        start, end = _parse_window(request, default_minutes=43200)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)

    bucket = request.query_params.get("bucket", "6h")
    return Response(_timeline_payload(request.user, project_id, start, end, bucket, request))


@api_view(["GET"])
def gcp_estate_replay_snapshot(request):
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"error": "GCP project not configured"}, status=400)

    try:
        _, end = _parse_window(request, default_minutes=43200)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)

    cursor = _parse_cursor(request, end)
    window_minutes = max(15, min(int(request.query_params.get("window_minutes", 1440)), 43200))
    return Response(_replay_snapshot_payload(request.user, project_id, cursor, window_minutes, request))


@api_view(["GET"])
def gcp_security_events(request):
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"error": "GCP project not configured"}, status=400)

    start, end = _parse_window(request, default_minutes=15)
    qs = _apply_event_filters(
        GcpSecurityEvent.objects.filter(
            user=request.user,
            project_id=project_id,
            timestamp__gte=start,
            timestamp__lte=end,
        ),
        request,
    )

    limit = min(int(request.query_params.get("limit", 200)), 1000)
    offset = int(request.query_params.get("offset", 0))
    total = qs.count()
    events = qs[offset : offset + limit]
    serializer = GcpSecurityEventSerializer(events, many=True)
    return Response({"count": total, "results": serializer.data})


@api_view(["GET"])
def gcp_security_incidents(request):
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"error": "GCP project not configured"}, status=400)

    explicit_window = any(
        request.query_params.get(key) is not None for key in ("start", "end", "minutes")
    )
    start, end = _parse_window(request, default_minutes=15)
    qs = GcpSecurityIncident.objects.filter(
        user=request.user,
        project_id=project_id,
        first_seen__lte=end,
        last_seen__gte=start,
    )
    if status_filter := request.query_params.get("status"):
        qs = qs.filter(status=status_filter)
    elif not explicit_window:
        qs = qs.filter(status__in=["open", "investigating"])

    serializer = GcpSecurityIncidentSerializer(qs[:100], many=True)
    return Response(serializer.data)


@api_view(["GET"])
def gcp_security_incident_detail(request, incident_id):
    try:
        incident = GcpSecurityIncident.objects.get(id=incident_id, user=request.user)
    except GcpSecurityIncident.DoesNotExist:
        return Response({"error": "Incident not found"}, status=404)

    serializer = GcpSecurityIncidentDetailSerializer(incident)
    return Response(serializer.data)


@api_view(["POST"])
def gcp_security_incident_ack(request, incident_id):
    try:
        incident = GcpSecurityIncident.objects.get(id=incident_id, user=request.user)
    except GcpSecurityIncident.DoesNotExist:
        return Response({"error": "Incident not found"}, status=404)

    incident.status = request.data.get("status", "investigating")
    incident.acknowledged_by = request.user.username
    incident.acknowledged_at = tz.now()
    incident.save(update_fields=["status", "acknowledged_by", "acknowledged_at", "updated_at"])

    serializer = GcpSecurityIncidentSerializer(incident)
    return Response(serializer.data)


@api_view(["GET"])
def gcp_security_map(request):
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"error": "GCP project not configured"}, status=400)

    start, end = _parse_window(request, default_minutes=15)
    data = (
        _apply_event_filters(
            GcpSecurityEvent.objects.filter(
                user=request.user,
                project_id=project_id,
                timestamp__gte=start,
                timestamp__lte=end,
                source_ip__isnull=False,
                severity__in=["medium", "high", "critical"],
            ),
            request,
        )
        .exclude(country="")
        .values("country", "geo_lat", "geo_lng")
        .annotate(
            count=Count("id"),
            critical=Count("id", filter=Q(severity="critical")),
            high=Count("id", filter=Q(severity="high")),
        )
        .order_by("-count")
    )
    return Response(list(data))


@api_view(["POST"])
def gcp_trigger_refresh(request):
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response(
            {"error": "GCP project not configured. Set project ID and service account key in Settings."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from monitor.services.gcp_aggregator import (
        _collection_errors_key,
        gcp_discover_services,
        gcp_fetch_logs,
        gcp_fetch_metrics,
        gcp_fetch_timeseries,
    )

    user_id = request.user.id
    cache.delete(_collection_errors_key(user_id))

    gcp_discover_services.delay(user_id)
    gcp_fetch_logs.delay(user_id)
    gcp_fetch_metrics.delay(user_id)
    gcp_fetch_timeseries.delay(user_id)
    return Response({"status": "refresh_triggered"})


@api_view(["POST"])
def gcp_ensure_collection(request):
    user_id = request.user.id
    cooldown_key = f"gcp_last_collection:{user_id}"
    if cache.get(cooldown_key):
        return Response({"triggered": False})

    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"triggered": False, "error": "GCP not configured"})

    from monitor.services.gcp_aggregator import (
        gcp_discover_services,
        gcp_fetch_logs,
        gcp_fetch_metrics,
        gcp_fetch_timeseries,
    )

    gcp_discover_services.delay(user_id)
    gcp_fetch_logs.delay(user_id)
    gcp_fetch_metrics.delay(user_id)
    gcp_fetch_timeseries.delay(user_id)

    cache.set(cooldown_key, True, timeout=15)
    return Response({"triggered": True})


@api_view(["POST"])
def gcp_ensure_history(request):
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"triggered": False, "error": "GCP not configured"})

    days = max(1, min(int(request.data.get("days", 30)), 30))

    from monitor.services.gcp_aggregator import (
        _history_trigger_key,
        gcp_backfill_history,
        get_history_status,
    )

    trigger_key = _history_trigger_key(request.user.id, days)
    if cache.get(trigger_key):
        return Response(
            {
                "triggered": False,
                "history_status": get_history_status(request.user.id),
            }
        )

    gcp_backfill_history.delay(request.user.id, days)
    cache.set(trigger_key, True, timeout=300)
    return Response(
        {
            "triggered": True,
            "history_status": get_history_status(request.user.id),
        }
    )
