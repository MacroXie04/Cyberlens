from django.db import models

from .scan import GitHubScan


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
    explanation = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["severity", "-id"]

    def __str__(self):
        return f"{self.severity}: {self.title} ({self.file_path}:{self.line_number})"
