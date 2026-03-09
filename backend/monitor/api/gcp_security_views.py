from django.db.models import Count, Q
from django.utils import timezone as tz
from rest_framework.decorators import api_view
from rest_framework.response import Response

from monitor.models import GcpSecurityEvent, GcpSecurityIncident
from monitor.serializers import GcpSecurityEventSerializer, GcpSecurityIncidentDetailSerializer, GcpSecurityIncidentSerializer

from .gcp_helpers import apply_event_filters, parse_window, require_project


@api_view(["GET"])
def gcp_security_events(request):
    project_id, error = require_project(request)
    if error:
        return error
    start, end = parse_window(request, default_minutes=15)
    queryset = apply_event_filters(
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
    return Response({"count": queryset.count(), "results": GcpSecurityEventSerializer(queryset[offset : offset + limit], many=True).data})


@api_view(["GET"])
def gcp_security_incidents(request):
    project_id, error = require_project(request)
    if error:
        return error
    explicit_window = any(request.query_params.get(key) is not None for key in ("start", "end", "minutes"))
    start, end = parse_window(request, default_minutes=15)
    queryset = GcpSecurityIncident.objects.filter(
        user=request.user,
        project_id=project_id,
        first_seen__lte=end,
        last_seen__gte=start,
    )
    if status_filter := request.query_params.get("status"):
        queryset = queryset.filter(status=status_filter)
    elif not explicit_window:
        queryset = queryset.filter(status__in=["open", "investigating"])
    return Response(GcpSecurityIncidentSerializer(queryset[:100], many=True).data)


@api_view(["GET"])
def gcp_security_incident_detail(request, incident_id):
    try:
        incident = GcpSecurityIncident.objects.get(id=incident_id, user=request.user)
    except GcpSecurityIncident.DoesNotExist:
        return Response({"error": "Incident not found"}, status=404)
    return Response(GcpSecurityIncidentDetailSerializer(incident).data)


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
    return Response(GcpSecurityIncidentSerializer(incident).data)


@api_view(["GET"])
def gcp_security_map(request):
    project_id, error = require_project(request)
    if error:
        return error
    start, end = parse_window(request, default_minutes=15)
    data = (
        apply_event_filters(
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
        .annotate(count=Count("id"), critical=Count("id", filter=Q(severity="critical")), high=Count("id", filter=Q(severity="high")))
        .order_by("-count")
    )
    return Response(list(data))
