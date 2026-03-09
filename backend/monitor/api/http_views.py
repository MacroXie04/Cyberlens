import logging
from django.db.models import Count, Q
from django.db.models.functions import TruncHour
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from monitor.models import Alert, AnalysisResult, HttpRequest
from monitor.serializers import AlertSerializer, HttpRequestSerializer

logger = logging.getLogger(__name__)


class HttpRequestViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HttpRequest.objects.select_related("analysis").all()
    serializer_class = HttpRequestSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        threat_level = self.request.query_params.get("threat_level")
        if threat_level:
            queryset = queryset.filter(analysis__threat_level=threat_level)
        return queryset


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
    return Response(
        {
            "total_requests": HttpRequest.objects.count(),
            "ai_analyzed": AnalysisResult.objects.count(),
            "threats_detected": AnalysisResult.objects.exclude(threat_level="safe").count(),
            "malicious_count": AnalysisResult.objects.filter(threat_level="malicious").count(),
        }
    )


@api_view(["GET"])
def stats_timeline(request):
    data = (
        HttpRequest.objects.annotate(hour=TruncHour("timestamp"))
        .values("hour")
        .annotate(
            total=Count("id"),
            threats=Count("id", filter=Q(analysis__threat_level__in=["suspicious", "malicious"])),
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
    from monitor.services.cloud_logging import fetch_cloud_run_logs

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

    max_entries = max(1, min(int(request.query_params.get("limit", 100)), 500))
    hours_back = max(1, min(int(request.query_params.get("hours", 1)), 720))
    try:
        return Response(
            fetch_cloud_run_logs(
                service_account_key_json=user_settings.gcp_service_account_key,
                project_id=user_settings.gcp_project_id,
                service_name=user_settings.gcp_service_name,
                max_entries=max_entries,
                hours_back=hours_back,
                severity=request.query_params.get("severity"),
                text_filter=request.query_params.get("q"),
                page_token=request.query_params.get("page_token"),
            )
        )
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
            threats=Count("id", filter=Q(analysis__threat_level__in=["suspicious", "malicious"])),
        )
        .order_by("-threats")
    )
    return Response(list(data))
