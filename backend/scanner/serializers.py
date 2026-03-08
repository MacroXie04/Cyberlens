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

    class Meta:
        model = GitHubScan
        fields = [
            "id",
            "repo_name",
            "repo_url",
            "scan_source",
            "scan_status",
            "total_deps",
            "vulnerable_deps",
            "security_score",
            "scanned_at",
            "dependencies",
            "code_findings",
            "code_scan_input_tokens",
            "code_scan_output_tokens",
            "code_scan_total_tokens",
            "code_scan_files_scanned",
            "code_scan_files_total",
            "code_scan_phase",
            "code_scan_stats_json",
        ]


class GitHubScanListSerializer(serializers.ModelSerializer):
    class Meta:
        model = GitHubScan
        fields = [
            "id",
            "repo_name",
            "repo_url",
            "scan_source",
            "scan_status",
            "total_deps",
            "vulnerable_deps",
            "security_score",
            "code_scan_phase",
            "scanned_at",
        ]


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
