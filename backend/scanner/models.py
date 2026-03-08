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

    repo_name = models.CharField(max_length=255)
    repo_url = models.CharField(max_length=500)
    scan_source = models.CharField(
        max_length=10, choices=Source.choices, default=Source.GITHUB
    )
    scan_status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    total_deps = models.IntegerField(default=0)
    vulnerable_deps = models.IntegerField(default=0)
    security_score = models.IntegerField(default=100)
    scanned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-scanned_at"]

    def __str__(self):
        return f"{self.repo_name} ({self.scan_status})"


class Dependency(models.Model):
    scan = models.ForeignKey(
        GitHubScan, on_delete=models.CASCADE, related_name="dependencies"
    )
    name = models.CharField(max_length=255)
    version = models.CharField(max_length=100)
    ecosystem = models.CharField(max_length=50)
    is_vulnerable = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = "dependencies"

    def __str__(self):
        return f"{self.name}@{self.version}"


class Vulnerability(models.Model):
    dependency = models.ForeignKey(
        Dependency, on_delete=models.CASCADE, related_name="vulnerabilities"
    )
    cve_id = models.CharField(max_length=50, blank=True, default="")
    cvss_score = models.FloatField(default=0.0)
    severity = models.CharField(max_length=20, blank=True, default="")
    summary = models.TextField(blank=True, default="")
    fixed_version = models.CharField(max_length=100, blank=True, default="")
    osv_id = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        verbose_name_plural = "vulnerabilities"

    def __str__(self):
        return f"{self.cve_id or self.osv_id} ({self.severity})"


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


class CodeFinding(models.Model):
    scan = models.ForeignKey(
        GitHubScan, on_delete=models.CASCADE, related_name="code_findings"
    )
    file_path = models.CharField(max_length=500)
    line_number = models.IntegerField(default=0)
    severity = models.CharField(max_length=20)
    category = models.CharField(max_length=50)
    title = models.CharField(max_length=255)
    description = models.TextField()
    code_snippet = models.TextField(blank=True, default="")
    recommendation = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["severity", "-id"]

    def __str__(self):
        return f"{self.severity}: {self.title} ({self.file_path}:{self.line_number})"
