from django.db import models


class HttpRequest(models.Model):
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    ip = models.GenericIPAddressField(db_index=True)
    method = models.CharField(max_length=10)
    path = models.TextField()
    status = models.IntegerField()
    user_agent = models.TextField(blank=True, default="")
    headers = models.JSONField(default=dict, blank=True)
    geo_country = models.CharField(max_length=100, blank=True, default="")
    geo_lat = models.FloatField(null=True, blank=True)
    geo_lng = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.method} {self.path} from {self.ip}"


class AnalysisResult(models.Model):
    class ThreatLevel(models.TextChoices):
        SAFE = "safe", "Safe"
        SUSPICIOUS = "suspicious", "Suspicious"
        MALICIOUS = "malicious", "Malicious"

    class ThreatType(models.TextChoices):
        NONE = "none", "None"
        SQL_INJECTION = "sql_injection", "SQL Injection"
        XSS = "xss", "XSS"
        PATH_TRAVERSAL = "path_traversal", "Path Traversal"
        BRUTE_FORCE = "brute_force", "Brute Force"
        BOT_SCRAPING = "bot_scraping", "Bot Scraping"
        DDOS = "ddos", "DDoS"
        UNKNOWN = "unknown", "Unknown"

    request = models.OneToOneField(
        HttpRequest, on_delete=models.CASCADE, related_name="analysis"
    )
    threat_level = models.CharField(
        max_length=20, choices=ThreatLevel.choices, default=ThreatLevel.SAFE
    )
    threat_type = models.CharField(
        max_length=20, choices=ThreatType.choices, default=ThreatType.NONE
    )
    confidence = models.FloatField(default=0.0)
    reason = models.TextField(blank=True, default="")
    recommendation = models.TextField(blank=True, default="")
    analyzed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.threat_level} - {self.threat_type} ({self.confidence:.0%})"


class Alert(models.Model):
    class Severity(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Warning"
        CRITICAL = "critical", "Critical"

    request = models.ForeignKey(
        HttpRequest, on_delete=models.CASCADE, related_name="alerts"
    )
    severity = models.CharField(
        max_length=10, choices=Severity.choices, default=Severity.INFO
    )
    message = models.TextField()
    acknowledged = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.severity}] {self.message[:50]}"
