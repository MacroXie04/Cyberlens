from django.contrib import admin

from unfold.admin import ModelAdmin

from scanner.models import AdkTraceEvent, CodeScanCandidate, CodeScanChunk, CodeScanFileIndex


@admin.register(AdkTraceEvent)
class AdkTraceEventAdmin(ModelAdmin):
    list_display = ["scan", "sequence", "phase", "kind", "status", "label", "created_at"]
    list_filter = ["phase", "kind", "status"]
    search_fields = ["scan__repo_name", "label", "parent_key", "text_preview"]
    readonly_fields = [
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
    list_per_page = 100


@admin.register(CodeScanFileIndex)
class CodeScanFileIndexAdmin(ModelAdmin):
    list_display = ["path", "scan", "language", "inventory_status", "created_at"]
    list_filter = ["language", "inventory_status"]
    search_fields = ["path", "scan__repo_name"]
    readonly_fields = [
        "scan",
        "path",
        "language",
        "content_hash",
        "imports_json",
        "role_flags_json",
        "inventory_status",
        "created_at",
    ]


@admin.register(CodeScanChunk)
class CodeScanChunkAdmin(ModelAdmin):
    list_display = ["chunk_key", "file_index", "start_line", "end_line", "summary_status"]
    list_filter = ["chunk_kind", "summary_status"]
    search_fields = ["chunk_key", "file_index__path", "file_index__scan__repo_name"]
    readonly_fields = [
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


@admin.register(CodeScanCandidate)
class CodeScanCandidateAdmin(ModelAdmin):
    list_display = ["label", "scan", "category", "score", "status", "verified_finding"]
    list_filter = ["category", "status", "severity_hint"]
    search_fields = ["label", "scan__repo_name", "rationale"]
    readonly_fields = [
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
