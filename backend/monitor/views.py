from django.db.models import Count, Q
from django.db.models.functions import TruncHour
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from .models import HttpRequest, AnalysisResult, Alert
from .serializers import HttpRequestSerializer, AlertSerializer


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
