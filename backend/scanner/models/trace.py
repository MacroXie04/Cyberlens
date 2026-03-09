from django.db import models

from .dependency import CodeFinding
from .scan import GitHubScan


class AdkTraceEvent(models.Model):
    class Phase(models.TextChoices):
        DEPENDENCY_INPUT = "dependency_input", "Dependency Input"
        DEPENDENCY_ADK_REPORT = "dependency_adk_report", "Dependency ADK Report"
        CODE_INVENTORY = "code_inventory", "Code Inventory"
        CHUNK_SUMMARY = "chunk_summary", "Chunk Summary"
        CANDIDATE_GENERATION = "candidate_generation", "Candidate Generation"
        EVIDENCE_EXPANSION = "evidence_expansion", "Evidence Expansion"
        VERIFICATION = "verification", "Verification"
        REPO_SYNTHESIS = "repo_synthesis", "Repo Synthesis"

    class Kind(models.TextChoices):
        STAGE_STARTED = "stage_started", "Stage Started"
        STAGE_COMPLETED = "stage_completed", "Stage Completed"
        LLM_PARTIAL = "llm_partial", "LLM Partial"
        LLM_COMPLETED = "llm_completed", "LLM Completed"
        ARTIFACT_CREATED = "artifact_created", "Artifact Created"
        METRIC = "metric", "Metric"
        WARNING = "warning", "Warning"
        ERROR = "error", "Error"

    scan = models.ForeignKey(
        GitHubScan, on_delete=models.CASCADE, related_name="adk_trace_events"
    )
    sequence = models.IntegerField()
    phase = models.CharField(max_length=40, choices=Phase.choices)
    kind = models.CharField(max_length=30, choices=Kind.choices)
    status = models.CharField(max_length=20, default="success")
    label = models.CharField(max_length=255, blank=True, default="")
    parent_key = models.CharField(max_length=255, blank=True, default="")
    input_tokens = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)
    total_tokens = models.IntegerField(default=0)
    duration_ms = models.IntegerField(default=0)
    text_preview = models.TextField(blank=True, default="")
    payload_json = models.JSONField(default=dict)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sequence", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["scan", "sequence"], name="unique_trace_sequence_per_scan"
            )
        ]

    def __str__(self):
        return f"{self.scan.repo_name} #{self.sequence} {self.phase}/{self.kind}"


class CodeScanFileIndex(models.Model):
    scan = models.ForeignKey(
        GitHubScan, on_delete=models.CASCADE, related_name="code_scan_file_indexes"
    )
    path = models.CharField(max_length=500)
    language = models.CharField(max_length=50, blank=True, default="")
    content_hash = models.CharField(max_length=64, blank=True, default="")
    imports_json = models.JSONField(default=list)
    role_flags_json = models.JSONField(default=list)
    inventory_status = models.CharField(max_length=20, default="indexed")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["path"]
        constraints = [
            models.UniqueConstraint(
                fields=["scan", "path"], name="unique_code_scan_file_per_scan"
            )
        ]

    def __str__(self):
        return self.path


class CodeScanChunk(models.Model):
    file_index = models.ForeignKey(
        CodeScanFileIndex, on_delete=models.CASCADE, related_name="chunks"
    )
    chunk_key = models.CharField(max_length=255, unique=True)
    chunk_kind = models.CharField(max_length=50, default="window")
    start_line = models.IntegerField()
    end_line = models.IntegerField()
    summary_json = models.JSONField(default=dict)
    signals_json = models.JSONField(default=list)
    summary_status = models.CharField(max_length=20, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["file_index__path", "start_line", "id"]

    def __str__(self):
        return self.chunk_key


class CodeScanCandidate(models.Model):
    scan = models.ForeignKey(
        GitHubScan, on_delete=models.CASCADE, related_name="code_scan_candidates"
    )
    category = models.CharField(max_length=50)
    label = models.CharField(max_length=255, blank=True, default="")
    score = models.FloatField(default=0.0)
    severity_hint = models.CharField(max_length=20, blank=True, default="")
    chunk_refs_json = models.JSONField(default=list)
    rationale = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, default="pending")
    verified_finding = models.ForeignKey(
        CodeFinding,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="source_candidates",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-score", "id"]

    def __str__(self):
        return f"{self.category} ({self.score:.2f})"
