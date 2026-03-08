from django.conf import settings
from django.db import models


class UserSettings(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="settings"
    )
    google_api_key = models.CharField(max_length=255, blank=True, default="")
    github_pat = models.CharField(max_length=255, blank=True, default="")
    gemini_model = models.CharField(max_length=100, blank=True, default="")
    cloud_run_url = models.URLField(max_length=500, blank=True, default="")
    gcp_project_id = models.CharField(max_length=100, blank=True, default="")
    gcp_service_name = models.CharField(max_length=100, blank=True, default="")
    gcp_region = models.CharField(max_length=50, blank=True, default="us-central1")
    gcp_service_account_key = models.TextField(blank=True, default="")
    gcp_regions = models.JSONField(default=list, blank=True)
    gcp_service_filters = models.JSONField(default=list, blank=True)
    gcp_enabled_sources = models.JSONField(
        default=list,
        blank=True,
        help_text="Enabled GCP data sources, e.g. cloud_run_logs, cloud_monitoring, load_balancer, cloud_armor, iam_audit, iap",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "user settings"

    def __str__(self):
        return f"Settings for {self.user.username}"


class GeminiLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="gemini_logs",
    )
    service = models.CharField(max_length=50)
    related_object_id = models.IntegerField(null=True, blank=True)
    model_name = models.CharField(max_length=100, default="gemini-2.5-flash")
    prompt_summary = models.TextField(blank=True, default="")
    response_summary = models.TextField(blank=True, default="")
    input_tokens = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)
    total_tokens = models.IntegerField(default=0)
    status = models.CharField(max_length=10)
    error_message = models.TextField(blank=True, default="")
    duration_ms = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.service} ({self.status}) - {self.created_at}"
