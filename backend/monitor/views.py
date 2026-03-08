import logging
from datetime import timedelta

from django.core.cache import cache
from django.db.models import Count, Q
from django.db.models.functions import TruncHour
from django.utils import timezone as tz
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from .models import (
    HttpRequest,
    AnalysisResult,
    Alert,
    GcpObservedService,
    GcpSecurityEvent,
    GcpSecurityIncident,
    GcpServiceHealth,
)
from .serializers import (
    HttpRequestSerializer,
    AlertSerializer,
    GcpObservedServiceSerializer,
    GcpSecurityEventSerializer,
    GcpSecurityIncidentSerializer,
    GcpSecurityIncidentDetailSerializer,
    GcpServiceHealthSerializer,
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
    """Fetch Cloud Run logs via Google Cloud Logging API."""
    from accounts.models import UserSettings

    user_settings, _ = UserSettings.objects.get_or_create(user=request.user)

    if not all([
        user_settings.gcp_project_id,
        user_settings.gcp_service_name,
        user_settings.gcp_service_account_key,
    ]):
        return Response(
            {"error": "GCP Cloud Logging not configured. Set project ID, service name, and service account key in Settings."},
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
    except Exception as e:
        logger.exception("Failed to fetch Cloud Run logs")
        return Response(
            {"error": f"Failed to fetch logs: {str(e)}"},
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
    """Get project_id from query params or user settings."""
    project_id = request.query_params.get("project_id")
    if project_id:
        return project_id
    from accounts.models import UserSettings
    try:
        settings = UserSettings.objects.get(user=request.user)
        return settings.gcp_project_id
    except UserSettings.DoesNotExist:
        return None


def _parse_time_range(request):
    """Parse time range from minutes query param, default 15m."""
    minutes = int(request.query_params.get("minutes", 15))
    minutes = max(1, min(minutes, 43200))  # 1 min to 30 days
    return tz.now() - timedelta(minutes=minutes)


@api_view(["GET"])
def gcp_estate_summary(request):
    """GET /api/gcp-estate/summary — project-level estate snapshot."""
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"error": "GCP project not configured"}, status=400)

    cutoff = _parse_time_range(request)

    services = GcpObservedService.objects.filter(
        user=request.user, project_id=project_id
    )

    open_incidents = GcpSecurityIncident.objects.filter(
        user=request.user, project_id=project_id,
        status__in=["open", "investigating"],
    ).count()

    recent_events = GcpSecurityEvent.objects.filter(
        user=request.user, project_id=project_id, timestamp__gte=cutoff
    )

    services_under_attack = (
        recent_events.filter(severity__in=["high", "critical"])
        .values("service").distinct().count()
    )

    armor_blocks = recent_events.filter(category="armor_block").count()
    auth_failures = recent_events.filter(
        category__in=["iap_auth_failure", "credential_abuse"]
    ).count()

    error_events = recent_events.filter(category="error_surge").count()
    total_events = recent_events.count()

    unhealthy = GcpObservedService.objects.filter(
        user=request.user, project_id=project_id, error_rate__gt=0.05
    ).count()

    from monitor.services.gcp_aggregator import get_collection_errors

    return Response({
        "project_id": project_id,
        "active_incidents": open_incidents,
        "services_under_attack": services_under_attack,
        "armor_blocks_recent": armor_blocks,
        "auth_failures_recent": auth_failures,
        "error_events_recent": error_events,
        "total_events_recent": total_events,
        "total_services": services.count(),
        "unhealthy_revisions": unhealthy,
        "collection_errors": get_collection_errors(request.user.id),
    })


@api_view(["GET"])
def gcp_estate_services(request):
    """GET /api/gcp-estate/services — all observed Cloud Run services."""
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"error": "GCP project not configured"}, status=400)

    services = GcpObservedService.objects.filter(
        user=request.user, project_id=project_id
    )
    serializer = GcpObservedServiceSerializer(services, many=True)
    return Response(serializer.data)


@api_view(["GET"])
def gcp_estate_timeseries(request):
    """GET /api/gcp-estate/timeseries — health metrics time-series."""
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"error": "GCP project not configured"}, status=400)

    cutoff = _parse_time_range(request)
    service = request.query_params.get("service")

    qs = GcpServiceHealth.objects.filter(
        user=request.user, project_id=project_id, bucket_end__gte=cutoff
    )
    if service:
        qs = qs.filter(service_name=service)

    serializer = GcpServiceHealthSerializer(qs[:500], many=True)
    return Response(serializer.data)


@api_view(["GET"])
def gcp_security_events(request):
    """GET /api/gcp-security/events — paginated security events."""
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"error": "GCP project not configured"}, status=400)

    cutoff = _parse_time_range(request)

    qs = GcpSecurityEvent.objects.filter(
        user=request.user, project_id=project_id, timestamp__gte=cutoff
    )

    # Filters
    severity = request.query_params.get("severity")
    if severity:
        qs = qs.filter(severity=severity)

    category = request.query_params.get("category")
    if category:
        qs = qs.filter(category=category)

    source = request.query_params.get("source")
    if source:
        qs = qs.filter(source=source)

    service = request.query_params.get("service")
    if service:
        qs = qs.filter(service=service)

    limit = min(int(request.query_params.get("limit", 200)), 1000)
    offset = int(request.query_params.get("offset", 0))

    total = qs.count()
    events = qs[offset:offset + limit]
    serializer = GcpSecurityEventSerializer(events, many=True)

    return Response({
        "count": total,
        "results": serializer.data,
    })


@api_view(["GET"])
def gcp_security_incidents(request):
    """GET /api/gcp-security/incidents — open/recent incidents."""
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"error": "GCP project not configured"}, status=400)

    status_filter = request.query_params.get("status")
    qs = GcpSecurityIncident.objects.filter(
        user=request.user, project_id=project_id
    )
    if status_filter:
        qs = qs.filter(status=status_filter)
    else:
        qs = qs.filter(status__in=["open", "investigating"])

    serializer = GcpSecurityIncidentSerializer(qs[:100], many=True)
    return Response(serializer.data)


@api_view(["GET"])
def gcp_security_incident_detail(request, incident_id):
    """GET /api/gcp-security/incidents/<id> — incident with linked events."""
    try:
        incident = GcpSecurityIncident.objects.get(
            id=incident_id, user=request.user
        )
    except GcpSecurityIncident.DoesNotExist:
        return Response({"error": "Incident not found"}, status=404)

    serializer = GcpSecurityIncidentDetailSerializer(incident)
    return Response(serializer.data)


@api_view(["POST"])
def gcp_security_incident_ack(request, incident_id):
    """POST /api/gcp-security/incidents/<id>/ack — acknowledge an incident."""
    try:
        incident = GcpSecurityIncident.objects.get(
            id=incident_id, user=request.user
        )
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
    """GET /api/gcp-security/map — geo attack data for the map widget."""
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"error": "GCP project not configured"}, status=400)

    cutoff = _parse_time_range(request)

    data = (
        GcpSecurityEvent.objects.filter(
            user=request.user,
            project_id=project_id,
            timestamp__gte=cutoff,
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
    return Response(list(data))


@api_view(["POST"])
def gcp_trigger_refresh(request):
    """POST /api/gcp-estate/refresh — manually trigger a full refresh cycle."""
    project_id = _get_user_project_id(request)
    if not project_id:
        return Response(
            {"error": "GCP project not configured. Set project ID and service account key in Settings."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from monitor.services.gcp_aggregator import (
        gcp_fetch_logs,
        gcp_fetch_metrics,
        gcp_discover_services,
        gcp_fetch_timeseries,
        _collection_errors_key,
    )

    user_id = request.user.id

    # Clear stale errors so fresh results take over
    cache.delete(_collection_errors_key(user_id))

    gcp_discover_services.delay(user_id)
    gcp_fetch_logs.delay(user_id)
    gcp_fetch_metrics.delay(user_id)
    gcp_fetch_timeseries.delay(user_id)

    return Response({"status": "refresh_triggered"})


@api_view(["POST"])
def gcp_ensure_collection(request):
    """POST /api/gcp-estate/ensure-collection/ — auto-trigger tasks with cooldown."""
    user_id = request.user.id
    cooldown_key = f"gcp_last_collection:{user_id}"

    if cache.get(cooldown_key):
        return Response({"triggered": False})

    project_id = _get_user_project_id(request)
    if not project_id:
        return Response({"triggered": False, "error": "GCP not configured"})

    from monitor.services.gcp_aggregator import (
        gcp_fetch_logs,
        gcp_fetch_metrics,
        gcp_discover_services,
        gcp_fetch_timeseries,
    )

    gcp_discover_services.delay(user_id)
    gcp_fetch_logs.delay(user_id)
    gcp_fetch_metrics.delay(user_id)
    gcp_fetch_timeseries.delay(user_id)

    cache.set(cooldown_key, True, timeout=15)

    return Response({"triggered": True})
