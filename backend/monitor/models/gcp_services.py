from django.conf import settings
from django.db import models


class GcpObservedService(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="gcp_services"
    )
    project_id = models.CharField(max_length=100, db_index=True)
    service_name = models.CharField(max_length=200)
    region = models.CharField(max_length=50)
    latest_revision = models.CharField(max_length=200, blank=True, default="")
    instance_count = models.IntegerField(default=0)
    url = models.URLField(max_length=500, blank=True, default="")
    last_deployed_at = models.DateTimeField(null=True, blank=True)
    risk_score = models.FloatField(default=0.0)
    risk_tags = models.JSONField(default=list, blank=True)
    request_rate = models.FloatField(default=0.0)
    error_rate = models.FloatField(default=0.0)
    p50_latency_ms = models.FloatField(default=0.0)
    p95_latency_ms = models.FloatField(default=0.0)
    p99_latency_ms = models.FloatField(default=0.0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "project_id", "service_name", "region")
        ordering = ["-risk_score", "service_name"]

    def __str__(self):
        return f"{self.service_name} ({self.region})"


class GcpServiceHealth(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="gcp_health"
    )
    project_id = models.CharField(max_length=100)
    service_name = models.CharField(max_length=200)
    region = models.CharField(max_length=50)
    request_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    latency_p50_ms = models.FloatField(default=0.0)
    latency_p95_ms = models.FloatField(default=0.0)
    latency_p99_ms = models.FloatField(default=0.0)
    instance_count = models.IntegerField(default=0)
    max_concurrency = models.FloatField(default=0.0)
    cpu_utilization = models.FloatField(default=0.0)
    memory_utilization = models.FloatField(default=0.0)
    unhealthy_revision_count = models.IntegerField(default=0)
    bucket_start = models.DateTimeField()
    bucket_end = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-bucket_end"]
        indexes = [
            models.Index(fields=["user", "project_id", "service_name", "-bucket_end"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "project_id", "service_name", "region", "bucket_end"],
                name="monitor_gcphealth_bucket_unique",
            ),
        ]

    def __str__(self):
        return f"{self.service_name} health ({self.bucket_start} - {self.bucket_end})"
