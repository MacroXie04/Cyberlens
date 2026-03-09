from rest_framework import serializers

from scanner.models import AiReport, CodeFinding, Dependency, Vulnerability


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
