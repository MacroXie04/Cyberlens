from rest_framework import serializers
from .models import (
    HttpRequest,
    AnalysisResult,
    Alert,
    GcpObservedService,
    GcpSecurityEvent,
    GcpSecurityIncident,
    GcpServiceHealth,
)


class AnalysisResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisResult
        fields = [
            "id",
            "threat_level",
            "threat_type",
            "confidence",
            "reason",
            "recommendation",
            "analyzed_at",
        ]


class HttpRequestSerializer(serializers.ModelSerializer):
    analysis = AnalysisResultSerializer(read_only=True)

    class Meta:
        model = HttpRequest
        fields = [
            "id",
            "timestamp",
            "ip",
            "method",
            "path",
            "status",
            "user_agent",
            "geo_country",
            "geo_lat",
            "geo_lng",
            "analysis",
        ]


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = ["id", "request", "severity", "message", "acknowledged", "created_at"]


# ---------------------------------------------------------------------------
# GCP Estate & Security Serializers
# ---------------------------------------------------------------------------

class GcpObservedServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = GcpObservedService
        fields = [
            "id",
            "project_id",
            "service_name",
            "region",
            "latest_revision",
            "instance_count",
            "url",
            "last_deployed_at",
            "risk_score",
            "risk_tags",
            "request_rate",
            "error_rate",
            "p50_latency_ms",
            "p95_latency_ms",
            "p99_latency_ms",
            "updated_at",
        ]


class GcpSecurityEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = GcpSecurityEvent
        fields = [
            "id",
            "source",
            "timestamp",
            "project_id",
            "region",
            "service",
            "revision",
            "severity",
            "category",
            "source_ip",
            "principal",
            "path",
            "method",
            "status_code",
            "trace_id",
            "request_id",
            "country",
            "geo_lat",
            "geo_lng",
            "evidence_refs",
            "raw_payload_preview",
            "fact_fields",
            "inference_fields",
            "incident",
        ]


class GcpSecurityIncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = GcpSecurityIncident
        fields = [
            "id",
            "project_id",
            "incident_type",
            "priority",
            "status",
            "confidence",
            "evidence_count",
            "services_affected",
            "regions_affected",
            "title",
            "narrative",
            "likely_cause",
            "next_steps",
            "ai_inference",
            "first_seen",
            "last_seen",
            "acknowledged_by",
            "acknowledged_at",
            "created_at",
            "updated_at",
        ]


class GcpSecurityIncidentDetailSerializer(GcpSecurityIncidentSerializer):
    events = GcpSecurityEventSerializer(many=True, read_only=True)

    class Meta(GcpSecurityIncidentSerializer.Meta):
        fields = GcpSecurityIncidentSerializer.Meta.fields + ["events"]


class GcpServiceHealthSerializer(serializers.ModelSerializer):
    class Meta:
        model = GcpServiceHealth
        fields = [
            "id",
            "project_id",
            "service_name",
            "region",
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
            "bucket_end",
        ]
