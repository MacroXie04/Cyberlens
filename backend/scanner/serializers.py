from rest_framework import serializers
from .models import (
    AdkTraceEvent,
    AiReport,
    CodeFinding,
    CodeScanCandidate,
    CodeScanChunk,
    CodeScanFileIndex,
    Dependency,
    GitHubScan,
    Vulnerability,
)


class VulnerabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Vulnerability
        fields = [
            "id",
            "cve_id",
            "cvss_score",
            "severity",
            "summary",
            "fixed_version",
            "osv_id",
        ]


class DependencySerializer(serializers.ModelSerializer):
    vulnerabilities = VulnerabilitySerializer(many=True, read_only=True)

    class Meta:
        model = Dependency
        fields = ["id", "name", "version", "ecosystem", "is_vulnerable", "vulnerabilities"]


class CodeFindingSerializer(serializers.ModelSerializer):
    class Meta:
        model = CodeFinding
        fields = [
            "id",
            "file_path",
            "line_number",
            "severity",
            "category",
            "title",
            "description",
            "code_snippet",
            "recommendation",
            "explanation",
        ]


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


class AiReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = AiReport
        fields = [
            "id",
            "executive_summary",
            "priority_ranking",
            "remediation_json",
            "generated_at",
        ]


class AdkTraceEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdkTraceEvent
        fields = [
            "id",
            "scan",
            "sequence",
            "phase",
            "kind",
            "status",
            "label",
            "parent_key",
            "input_tokens",
            "output_tokens",
            "total_tokens",
            "duration_ms",
            "text_preview",
            "payload_json",
            "started_at",
            "ended_at",
            "created_at",
        ]


class CodeScanFileIndexSerializer(serializers.ModelSerializer):
    class Meta:
        model = CodeScanFileIndex
        fields = [
            "id",
            "scan",
            "path",
            "language",
            "content_hash",
            "imports_json",
            "role_flags_json",
            "inventory_status",
            "created_at",
        ]


class CodeScanChunkSerializer(serializers.ModelSerializer):
    file_index = CodeScanFileIndexSerializer(read_only=True)

    class Meta:
        model = CodeScanChunk
        fields = [
            "id",
            "file_index",
            "chunk_key",
            "chunk_kind",
            "start_line",
            "end_line",
            "summary_json",
            "signals_json",
            "summary_status",
            "created_at",
        ]


class CodeScanCandidateSerializer(serializers.ModelSerializer):
    verified_finding = CodeFindingSerializer(read_only=True)

    class Meta:
        model = CodeScanCandidate
        fields = [
            "id",
            "scan",
            "category",
            "label",
            "score",
            "severity_hint",
            "chunk_refs_json",
            "rationale",
            "status",
            "verified_finding",
            "created_at",
        ]
