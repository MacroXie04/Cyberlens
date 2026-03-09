from rest_framework import serializers

from scanner.models import GitHubScan

from .core import CodeFindingSerializer, DependencySerializer


class GitHubScanSerializer(serializers.ModelSerializer):
    dependencies = DependencySerializer(many=True, read_only=True)
    code_findings = CodeFindingSerializer(many=True, read_only=True)
    code_findings_count = serializers.SerializerMethodField()
    started_at = serializers.DateTimeField(source="scanned_at", read_only=True)
    duration_ms = serializers.SerializerMethodField()

    class Meta:
        model = GitHubScan
        fields = [
            "id",
            "repo_name",
            "repo_url",
            "scan_source",
            "scan_mode",
            "scan_status",
            "total_deps",
            "vulnerable_deps",
            "security_score",
            "dependency_score",
            "code_security_score",
            "scanned_at",
            "started_at",
            "completed_at",
            "duration_ms",
            "dependencies",
            "code_findings",
            "code_findings_count",
            "code_scan_input_tokens",
            "code_scan_output_tokens",
            "code_scan_total_tokens",
            "code_scan_files_scanned",
            "code_scan_files_total",
            "code_scan_phase",
            "code_scan_stats_json",
            "error_message",
        ]

    def get_code_findings_count(self, obj):
        return getattr(obj, "code_findings_count", None) or obj.code_findings.count()

    def get_duration_ms(self, obj):
        if not obj.completed_at:
            return 0
        return int((obj.completed_at - obj.scanned_at).total_seconds() * 1000)


class GitHubScanListSerializer(serializers.ModelSerializer):
    code_findings_count = serializers.IntegerField(read_only=True, default=0)
    started_at = serializers.DateTimeField(source="scanned_at", read_only=True)
    duration_ms = serializers.SerializerMethodField()

    class Meta:
        model = GitHubScan
        fields = [
            "id",
            "repo_name",
            "repo_url",
            "scan_source",
            "scan_mode",
            "scan_status",
            "total_deps",
            "vulnerable_deps",
            "security_score",
            "dependency_score",
            "code_security_score",
            "code_findings_count",
            "code_scan_phase",
            "scanned_at",
            "started_at",
            "completed_at",
            "duration_ms",
            "error_message",
        ]

    def get_duration_ms(self, obj):
        if not obj.completed_at:
            return 0
        return int((obj.completed_at - obj.scanned_at).total_seconds() * 1000)
