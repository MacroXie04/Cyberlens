from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from django.contrib.auth.models import User, Group

from unfold.admin import ModelAdmin
from unfold.decorators import display
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm

from .models import UserSettings, GeminiLog

# Override built-in User and Group with unfold styling
admin.site.unregister(User)
admin.site.unregister(Group)


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm


@admin.register(Group)
class GroupAdmin(BaseGroupAdmin, ModelAdmin):
    pass


@admin.register(UserSettings)
class UserSettingsAdmin(ModelAdmin):
    list_display = ["user", "has_api_key", "has_github_pat", "has_cloud_run_url", "has_gcp_logging", "updated_at"]
    list_filter = ["updated_at"]
    search_fields = ["user__username", "user__email"]
    readonly_fields = ["created_at", "updated_at"]
    list_per_page = 25

    @display(description="API Key", boolean=True)
    def has_api_key(self, obj):
        return bool(obj.google_api_key)

    @display(description="GitHub PAT", boolean=True)
    def has_github_pat(self, obj):
        return bool(obj.github_pat)

    @display(description="Cloud Run URL", boolean=True)
    def has_cloud_run_url(self, obj):
        return bool(obj.cloud_run_url)

    @display(description="GCP Logging", boolean=True)
    def has_gcp_logging(self, obj):
        return bool(obj.gcp_project_id and obj.gcp_service_account_key)


@admin.register(GeminiLog)
class GeminiLogAdmin(ModelAdmin):
    list_display = [
        "service", "user", "model_name", "show_status", "input_tokens",
        "output_tokens", "total_tokens", "duration_ms", "created_at",
    ]
    list_filter = ["service", "status", "model_name"]
    search_fields = ["service", "prompt_summary", "user__username"]
    readonly_fields = [
        "user", "service", "related_object_id", "model_name",
        "prompt_summary", "response_summary", "input_tokens",
        "output_tokens", "total_tokens", "status", "error_message",
        "duration_ms", "created_at",
    ]
    list_per_page = 50
    date_hierarchy = "created_at"

    @display(
        description="Status",
        ordering="status",
        label={
            "success": "success",
            "error": "danger",
        },
    )
    def show_status(self, obj):
        return obj.status
