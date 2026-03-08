from django.contrib import admin

from unfold.admin import ModelAdmin, TabularInline, StackedInline
from unfold.decorators import display

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


# --- Inlines ---

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
        "cve_id", "cvss_score", "severity", "summary",
        "fixed_version", "osv_id",
    ]
    can_delete = False


class AiReportInline(StackedInline):
    model = AiReport
    extra = 0
    max_num = 1
    readonly_fields = [
        "executive_summary", "priority_ranking",
        "remediation_json", "generated_at",
    ]
    can_delete = False


class CodeFindingInline(TabularInline):
    model = CodeFinding
    extra = 0
    readonly_fields = [
        "file_path", "line_number", "severity", "category",
        "title", "description",
    ]
    fields = ["severity", "category", "title", "file_path", "line_number"]
    can_delete = False
    show_change_link = True


# --- ModelAdmins ---

@admin.register(GitHubScan)
class GitHubScanAdmin(ModelAdmin):
    list_display = [
        "repo_name", "user", "show_scan_source", "show_scan_status",
        "total_deps", "vulnerable_deps", "security_score",
        "code_scan_files_scanned", "scanned_at",
    ]
    list_filter = ["scan_status", "scan_source"]
    search_fields = ["repo_name", "repo_url", "user__username"]
    readonly_fields = [
        "user", "repo_name", "repo_url", "scan_source", "scan_status",
        "total_deps", "vulnerable_deps", "security_score",
        "code_scan_input_tokens", "code_scan_output_tokens",
        "code_scan_total_tokens", "code_scan_files_scanned",
        "code_scan_files_total", "scanned_at",
    ]
    list_per_page = 25
    date_hierarchy = "scanned_at"
    inlines = [DependencyInline, AiReportInline, CodeFindingInline]

    @display(
        description="Source",
        ordering="scan_source",
        label={
            "github": "info",
            "local": "success",
        },
    )
    def show_scan_source(self, obj):
        return obj.scan_source

    @display(
        description="Status",
        ordering="scan_status",
        label={
            "pending": "info",
            "scanning": "warning",
            "completed": "success",
            "failed": "danger",
        },
    )
    def show_scan_status(self, obj):
        return obj.scan_status


@admin.register(Dependency)
class DependencyAdmin(ModelAdmin):
    list_display = [
        "name", "version", "ecosystem", "scan_repo",
        "show_vulnerable",
    ]
    list_filter = ["ecosystem", "is_vulnerable"]
    search_fields = ["name", "version", "scan__repo_name"]
    readonly_fields = ["scan", "name", "version", "ecosystem", "is_vulnerable"]
    list_per_page = 50
    inlines = [VulnerabilityInline]

    @display(description="Scan", ordering="scan__repo_name")
    def scan_repo(self, obj):
        return obj.scan.repo_name

    @display(
        description="Vulnerable",
        ordering="is_vulnerable",
        label={
            True: "danger",
            False: "success",
        },
    )
    def show_vulnerable(self, obj):
        return obj.is_vulnerable


@admin.register(Vulnerability)
class VulnerabilityAdmin(ModelAdmin):
    list_display = [
        "cve_id", "osv_id", "show_severity", "cvss_score",
        "dependency_name", "fixed_version",
    ]
    list_filter = ["severity"]
    search_fields = [
        "cve_id", "osv_id", "summary",
        "dependency__name", "dependency__scan__repo_name",
    ]
    readonly_fields = [
        "dependency", "cve_id", "cvss_score", "severity",
        "summary", "fixed_version", "osv_id",
    ]
    list_per_page = 50

    @display(description="Dependency", ordering="dependency__name")
    def dependency_name(self, obj):
        return f"{obj.dependency.name}@{obj.dependency.version}"

    @display(
        description="Severity",
        ordering="severity",
        label={
            "critical": "danger",
            "high": "danger",
            "moderate": "warning",
            "medium": "warning",
            "low": "info",
        },
    )
    def show_severity(self, obj):
        return obj.severity


@admin.register(AiReport)
class AiReportAdmin(ModelAdmin):
    list_display = ["scan_repo", "short_summary", "generated_at"]
    search_fields = ["scan__repo_name", "executive_summary"]
    readonly_fields = [
        "scan", "executive_summary", "priority_ranking",
        "remediation_json", "generated_at",
    ]
    list_per_page = 25

    @display(description="Scan", ordering="scan__repo_name")
    def scan_repo(self, obj):
        return obj.scan.repo_name

    @display(description="Summary")
    def short_summary(self, obj):
        text = obj.executive_summary
        return text if len(text) <= 100 else text[:97] + "..."


@admin.register(CodeFinding)
class CodeFindingAdmin(ModelAdmin):
    list_display = [
        "title", "show_severity", "category", "file_path",
        "line_number", "scan_repo",
    ]
    list_filter = ["severity", "category"]
    search_fields = [
        "title", "description", "file_path", "category",
        "scan__repo_name",
    ]
    readonly_fields = [
        "scan", "file_path", "line_number", "severity", "category",
        "title", "description", "code_snippet", "recommendation",
    ]
    list_per_page = 50

    @display(description="Scan", ordering="scan__repo_name")
    def scan_repo(self, obj):
        return obj.scan.repo_name

    @display(
        description="Severity",
        ordering="severity",
        label={
            "critical": "danger",
            "high": "danger",
            "medium": "warning",
            "moderate": "warning",
            "low": "info",
            "info": "info",
        },
    )
    def show_severity(self, obj):
        return obj.severity


@admin.register(AdkTraceEvent)
class AdkTraceEventAdmin(ModelAdmin):
    list_display = ["scan", "sequence", "phase", "kind", "status", "label", "created_at"]
    list_filter = ["phase", "kind", "status"]
    search_fields = ["scan__repo_name", "label", "parent_key", "text_preview"]
    readonly_fields = [
        "scan", "sequence", "phase", "kind", "status", "label", "parent_key",
        "input_tokens", "output_tokens", "total_tokens", "duration_ms",
        "text_preview", "payload_json", "started_at", "ended_at", "created_at",
    ]
    list_per_page = 100


@admin.register(CodeScanFileIndex)
class CodeScanFileIndexAdmin(ModelAdmin):
    list_display = ["path", "scan", "language", "inventory_status", "created_at"]
    list_filter = ["language", "inventory_status"]
    search_fields = ["path", "scan__repo_name"]
    readonly_fields = [
        "scan", "path", "language", "content_hash", "imports_json",
        "role_flags_json", "inventory_status", "created_at",
    ]


@admin.register(CodeScanChunk)
class CodeScanChunkAdmin(ModelAdmin):
    list_display = ["chunk_key", "file_index", "start_line", "end_line", "summary_status"]
    list_filter = ["chunk_kind", "summary_status"]
    search_fields = ["chunk_key", "file_index__path", "file_index__scan__repo_name"]
    readonly_fields = [
        "file_index", "chunk_key", "chunk_kind", "start_line", "end_line",
        "summary_json", "signals_json", "summary_status", "created_at",
    ]


@admin.register(CodeScanCandidate)
class CodeScanCandidateAdmin(ModelAdmin):
    list_display = ["label", "scan", "category", "score", "status", "verified_finding"]
    list_filter = ["category", "status", "severity_hint"]
    search_fields = ["label", "scan__repo_name", "rationale"]
    readonly_fields = [
        "scan", "category", "label", "score", "severity_hint", "chunk_refs_json",
        "rationale", "status", "verified_finding", "created_at",
    ]
