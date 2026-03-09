from django.conf import settings
from django.db import models


class GcpSecurityEvent(models.Model):
    class Source(models.TextChoices):
        CLOUD_RUN_LOGS = "cloud_run_logs"
        CLOUD_MONITORING = "cloud_monitoring"
        LOAD_BALANCER = "load_balancer"
        CLOUD_ARMOR = "cloud_armor"
        IAM_AUDIT = "iam_audit"
        IAP = "iap"

    class Severity(models.TextChoices):
        INFO = "info"
        LOW = "low"
        MEDIUM = "medium"
        HIGH = "high"
        CRITICAL = "critical"

    class Category(models.TextChoices):
        SQL_INJECTION = "sql_injection"
        XSS = "xss"
        PATH_TRAVERSAL = "path_traversal"
        BOT_PROBING = "bot_probing"
        CREDENTIAL_ABUSE = "credential_abuse"
        ARMOR_BLOCK = "armor_block"
        IAP_AUTH_FAILURE = "iap_auth_failure"
        IAM_DRIFT = "iam_drift"
        ERROR_SURGE = "error_surge"
        LATENCY_SURGE = "latency_surge"
        REVISION_REGRESSION = "revision_regression"
        COLD_START_SURGE = "cold_start_surge"
        RATE_LIMIT = "rate_limit"
        OTHER = "other"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="gcp_events"
    )
    source = models.CharField(max_length=30, choices=Source.choices)
    timestamp = models.DateTimeField(db_index=True)
    project_id = models.CharField(max_length=100, db_index=True)
    region = models.CharField(max_length=50, blank=True, default="")
    service = models.CharField(max_length=200, blank=True, default="")
    revision = models.CharField(max_length=200, blank=True, default="")
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.INFO)
    category = models.CharField(max_length=30, choices=Category.choices, default=Category.OTHER)
    source_ip = models.GenericIPAddressField(null=True, blank=True)
    principal = models.CharField(max_length=300, blank=True, default="")
    path = models.TextField(blank=True, default="")
    method = models.CharField(max_length=10, blank=True, default="")
    status_code = models.IntegerField(null=True, blank=True)
    trace_id = models.CharField(max_length=200, blank=True, default="")
    request_id = models.CharField(max_length=200, blank=True, default="")
    fingerprint = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    country = models.CharField(max_length=100, blank=True, default="")
    geo_lat = models.FloatField(null=True, blank=True)
    geo_lng = models.FloatField(null=True, blank=True)
    evidence_refs = models.JSONField(default=list, blank=True)
    raw_payload_preview = models.TextField(blank=True, default="")
    fact_fields = models.JSONField(default=dict, blank=True)
    inference_fields = models.JSONField(default=dict, blank=True)
    incident = models.ForeignKey(
        "GcpSecurityIncident",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="events",
    )

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["user", "project_id", "-timestamp"]),
            models.Index(fields=["user", "severity", "-timestamp"]),
            models.Index(fields=["user", "category", "-timestamp"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "project_id", "fingerprint"],
                condition=models.Q(fingerprint__isnull=False),
                name="monitor_gcpevent_fingerprint_unique",
            ),
        ]

    def __str__(self):
        return f"[{self.severity}] {self.category} @ {self.service} ({self.timestamp})"


class GcpSecurityIncident(models.Model):
    class Priority(models.TextChoices):
        P4 = "p4", "Low"
        P3 = "p3", "Medium"
        P2 = "p2", "High"
        P1 = "p1", "Critical"

    class Status(models.TextChoices):
        OPEN = "open"
        INVESTIGATING = "investigating"
        MITIGATED = "mitigated"
        RESOLVED = "resolved"
        FALSE_POSITIVE = "false_positive"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="gcp_incidents"
    )
    project_id = models.CharField(max_length=100, db_index=True)
    incident_type = models.CharField(max_length=60)
    priority = models.CharField(max_length=5, choices=Priority.choices, default=Priority.P3)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    confidence = models.FloatField(default=0.0)
    evidence_count = models.IntegerField(default=0)
    services_affected = models.JSONField(default=list, blank=True)
    regions_affected = models.JSONField(default=list, blank=True)
    title = models.CharField(max_length=300, blank=True, default="")
    narrative = models.TextField(blank=True, default="")
    likely_cause = models.TextField(blank=True, default="")
    next_steps = models.JSONField(default=list, blank=True)
    ai_inference = models.JSONField(default=dict, blank=True)
    first_seen = models.DateTimeField()
    last_seen = models.DateTimeField()
    acknowledged_by = models.CharField(max_length=200, blank=True, default="")
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_seen"]
        indexes = [
            models.Index(fields=["user", "project_id", "-last_seen"]),
            models.Index(fields=["user", "status", "-last_seen"]),
        ]

    def __str__(self):
        return f"[{self.priority}] {self.incident_type}: {self.title[:60]}"
