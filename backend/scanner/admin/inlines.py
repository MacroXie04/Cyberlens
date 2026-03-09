from unfold.admin import StackedInline, TabularInline

from scanner.models import AiReport, CodeFinding, Dependency, Vulnerability


class DependencyInline(TabularInline):
    model = Dependency
    extra = 0
    readonly_fields = ["name", "version", "ecosystem", "is_vulnerable"]
    can_delete = False
    show_change_link = True


class VulnerabilityInline(TabularInline):
    model = Vulnerability
    extra = 0
    readonly_fields = [
        "cve_id",
        "cvss_score",
        "severity",
        "summary",
        "fixed_version",
        "osv_id",
    ]
    can_delete = False


class AiReportInline(StackedInline):
    model = AiReport
    extra = 0
    max_num = 1
    readonly_fields = [
        "executive_summary",
        "priority_ranking",
        "remediation_json",
        "generated_at",
    ]
    can_delete = False


class CodeFindingInline(TabularInline):
    model = CodeFinding
    extra = 0
    readonly_fields = [
        "file_path",
        "line_number",
        "severity",
        "category",
        "title",
        "description",
    ]
    fields = ["severity", "category", "title", "file_path", "line_number"]
    can_delete = False
    show_change_link = True
