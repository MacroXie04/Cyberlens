from rest_framework import serializers
from .models import HttpRequest, AnalysisResult, Alert


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
