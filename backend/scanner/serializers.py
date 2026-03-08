from rest_framework import serializers
from .models import GitHubScan, Dependency, Vulnerability, AiReport, CodeFinding


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
