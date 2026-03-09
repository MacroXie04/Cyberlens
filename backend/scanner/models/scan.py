from django.conf import settings
from django.db import models


class GitHubScan(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SCANNING = "scanning", "Scanning"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    class Source(models.TextChoices):
        GITHUB = "github", "GitHub"
        LOCAL = "local", "Local"

    class Mode(models.TextChoices):
        FAST = "fast", "Fast Scan"
        FULL = "full", "Full Scan"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="scans",
    )
    repo_name = models.CharField(max_length=255)
    repo_url = models.CharField(max_length=500)
    scan_source = models.CharField(max_length=10, choices=Source.choices, default=Source.GITHUB)
    scan_mode = models.CharField(max_length=10, choices=Mode.choices, default=Mode.FAST)
    scan_status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    total_deps = models.IntegerField(default=0)
    vulnerable_deps = models.IntegerField(default=0)
    security_score = models.IntegerField(default=100)
    dependency_score = models.IntegerField(default=100)
    code_security_score = models.IntegerField(default=100)
    code_scan_input_tokens = models.IntegerField(default=0)
    code_scan_output_tokens = models.IntegerField(default=0)
    code_scan_total_tokens = models.IntegerField(default=0)
    code_scan_files_scanned = models.IntegerField(default=0)
    code_scan_files_total = models.IntegerField(default=0)
    code_scan_phase = models.CharField(max_length=50, blank=True, default="")
    code_scan_stats_json = models.JSONField(default=dict)
    trace_sequence_counter = models.IntegerField(default=0)
    error_message = models.TextField(blank=True, default="")
    scanned_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-scanned_at"]

    def __str__(self):
        return f"{self.repo_name} ({self.scan_status})"


class AiReport(models.Model):
    scan = models.OneToOneField(
        GitHubScan, on_delete=models.CASCADE, related_name="ai_report"
    )
    executive_summary = models.TextField(blank=True, default="")
    priority_ranking = models.JSONField(default=list)
    remediation_json = models.JSONField(default=dict)
    generated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Report for {self.scan.repo_name}"
