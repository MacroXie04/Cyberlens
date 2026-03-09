from pydantic import BaseModel, Field

CHUNK_SUMMARY_INSTRUCTION = """You are a security-oriented code summarizer.
Analyze the provided code chunk and return only structured JSON.

Focus on:
- symbols declared or referenced
- imports/exports
- whether this chunk is an entrypoint, route, middleware, config, model, or helper
- trust boundary context
- security-relevant signals such as input sources, dangerous sinks, auth logic, secrets,
  network access, file access, deserialization, and crypto usage
- a short suspicion note if this chunk deserves follow-up

Do not report a final vulnerability verdict here. Compress the chunk into retrieval-friendly security metadata."""

CANDIDATE_GENERATION_INSTRUCTION = """You are a security triage agent.
You are given compressed summaries of code chunks and one risk category to focus on.

Return only the strongest candidate vulnerabilities for that category.
Each candidate must:
- reference only chunk_keys present in the input
- explain why the chunks matter
- estimate a score between 0 and 1
- say whether it looks cross-file

Prefer high-recall but avoid inventing chunk references."""

VERIFICATION_INSTRUCTION = """You are a senior application security reviewer.
You are given one candidate issue plus a bounded evidence pack containing code snippets.

Decide whether the issue is real.
Only confirm a finding when the evidence shows a concrete security weakness.
Do not invent files or lines outside the provided evidence pack."""

REPO_SYNTHESIS_INSTRUCTION = """You are a security report synthesizer.
Summarize the repository-level results of a completed code scan.
Focus on the most important hotspots and what the scan found or did not find.
Return only structured JSON."""


class ChunkSummary(BaseModel):
    symbols: list[str] = Field(default_factory=list)
    imports: list[str] = Field(default_factory=list)
    exports: list[str] = Field(default_factory=list)
    entrypoint_type: str = Field(default="other")
    trust_boundary: str = Field(default="internal")
    security_signals: list[str] = Field(default_factory=list)
    suspicion_notes: str = Field(default="")
    summary: str = Field(default="")


class CandidateSpec(BaseModel):
    category: str
    label: str = Field(default="")
    score: float = Field(default=0.0, ge=0.0, le=1.0)
    severity_hint: str = Field(default="medium")
    chunk_refs: list[str] = Field(default_factory=list)
    rationale: str = Field(default="")
    is_cross_file: bool = Field(default=False)


class CandidateBatch(BaseModel):
    candidates: list[CandidateSpec] = Field(default_factory=list)


class VerificationDecision(BaseModel):
    is_real_issue: bool = Field(default=False)
    decision: str = Field(default="rejected")
    category: str = Field(default="other")
    file_path: str = Field(default="")
    line_number: int = Field(default=0)
    severity: str = Field(default="info")
    title: str = Field(default="")
    description: str = Field(default="")
    code_snippet: str = Field(default="")
    recommendation: str = Field(default="")
    evidence_refs: list[str] = Field(default_factory=list)
    dataflow_or_controlflow_explanation: str = Field(default="")


class RepoSynthesisReport(BaseModel):
    summary: str = Field(default="")
    hotspots: list[str] = Field(default_factory=list)
    verified_findings: int = Field(default=0)
    candidate_count: int = Field(default=0)
