from django.contrib import admin

from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import display

from .models import HttpRequest, AnalysisResult, Alert


# --- Inlines ---

class AnalysisResultInline(TabularInline):
    model = AnalysisResult
    extra = 0
    max_num = 1
    readonly_fields = [
        "threat_level", "threat_type", "confidence", "reason",
        "recommendation", "analyzed_at",
    ]
    can_delete = False


class AlertInline(TabularInline):
    model = Alert
    extra = 0
    readonly_fields = ["severity", "message", "created_at"]
    fields = ["severity", "message", "acknowledged", "created_at"]


# --- ModelAdmins ---

@admin.register(HttpRequest)
class HttpRequestAdmin(ModelAdmin):
    list_display = [
        "timestamp", "ip", "method", "short_path", "status",
        "geo_country", "has_analysis",
    ]
    list_filter = ["method", "status", "geo_country"]
    search_fields = ["ip", "path", "user_agent", "geo_country"]
    readonly_fields = [
        "timestamp", "ip", "method", "path", "status",
        "user_agent", "headers", "geo_country", "geo_lat", "geo_lng",
    ]
    list_per_page = 50
    date_hierarchy = "timestamp"
    inlines = [AnalysisResultInline, AlertInline]

    @display(description="Path", ordering="path")
    def short_path(self, obj):
        path = obj.path
        return path if len(path) <= 60 else path[:57] + "..."

    @display(description="Analyzed", boolean=True)
    def has_analysis(self, obj):
        return hasattr(obj, "analysis")


@admin.register(AnalysisResult)
class AnalysisResultAdmin(ModelAdmin):
    list_display = [
        "request_summary", "show_threat_level", "show_threat_type",
        "confidence", "analyzed_at",
    ]
    list_filter = ["threat_level", "threat_type"]
    search_fields = ["request__ip", "request__path", "reason"]
    readonly_fields = [
        "request", "threat_level", "threat_type", "confidence",
        "reason", "recommendation", "analyzed_at",
    ]
    list_per_page = 50
    date_hierarchy = "analyzed_at"

    @display(description="Request", ordering="request__ip")
    def request_summary(self, obj):
        return f"{obj.request.method} {obj.request.path} ({obj.request.ip})"

    @display(
        description="Threat Level",
        ordering="threat_level",
        label={
            "safe": "success",
            "suspicious": "warning",
            "malicious": "danger",
        },
    )
    def show_threat_level(self, obj):
        return obj.threat_level

    @display(
        description="Threat Type",
        ordering="threat_type",
        label=True,
    )
    def show_threat_type(self, obj):
        return obj.threat_type


@admin.register(Alert)
class AlertAdmin(ModelAdmin):
    list_display = [
        "show_severity", "short_message", "request_ip",
        "acknowledged", "created_at",
    ]
    list_filter = ["severity", "acknowledged"]
    search_fields = ["message", "request__ip", "request__path"]
    readonly_fields = ["request", "severity", "message", "created_at"]
    list_per_page = 50
    date_hierarchy = "created_at"
    actions = ["mark_acknowledged"]

    @display(
        description="Severity",
        ordering="severity",
        label={
            "info": "info",
            "warning": "warning",
            "critical": "danger",
        },
    )
    def show_severity(self, obj):
        return obj.severity

    @display(description="Message")
    def short_message(self, obj):
        return obj.message if len(obj.message) <= 80 else obj.message[:77] + "..."

    @display(description="Source IP", ordering="request__ip")
    def request_ip(self, obj):
        return obj.request.ip

    @admin.action(description="Mark selected alerts as acknowledged")
    def mark_acknowledged(self, request, queryset):
        updated = queryset.update(acknowledged=True)
        self.message_user(request, f"{updated} alert(s) marked as acknowledged.")
