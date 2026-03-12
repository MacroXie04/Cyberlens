from scanner.models import AdkTraceEvent
from scanner.services.code_scanner import (
    CandidateBatch,
    CandidateSpec,
    ChunkSummary,
    RepoSynthesisReport,
    VerificationDecision,
)


def fake_structured_agent(*args, **kwargs):
    phase = kwargs["phase"]
    payload = kwargs["input_payload"]

    if phase == AdkTraceEvent.Phase.CHUNK_SUMMARY:
        return (
            ChunkSummary(
                symbols=["dangerous"],
                imports=["os"],
                entrypoint_type="route",
                trust_boundary="user_input",
                security_signals=["command_injection"],
                suspicion_notes="Shell invocation uses user input",
                summary="Potential command execution surface",
            ),
            {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15},
            '{"summary":"Potential command execution surface"}',
        )

    if phase == AdkTraceEvent.Phase.CANDIDATE_GENERATION:
        if payload["risk_category"] == "injection":
            first_chunk = payload["chunks"][0]["chunk_key"]
            return (
                CandidateBatch(
                    candidates=[
                        CandidateSpec(
                            category="command_injection",
                            label="Shell execution path",
                            score=0.91,
                            severity_hint="high",
                            chunk_refs=[first_chunk],
                            rationale="User-controlled input reaches a shell-like API.",
                            is_cross_file=False,
                        )
                    ]
                ),
                {"input_tokens": 20, "output_tokens": 8, "total_tokens": 28},
                '{"candidates":[{"label":"Shell execution path"}]}',
            )
        return (
            CandidateBatch(candidates=[]),
            {"input_tokens": 5, "output_tokens": 2, "total_tokens": 7},
            '{"candidates":[]}',
        )

    if phase == AdkTraceEvent.Phase.VERIFICATION:
        first_member = payload["evidence_pack"]["members"][0]
        return (
            VerificationDecision(
                is_real_issue=True,
                decision="confirmed",
                category="command_injection",
                file_path=first_member["file_path"],
                line_number=first_member["line_range"][0],
                severity="high",
                title="Command injection",
                description="User input reaches a shell execution sink without validation.",
                code_snippet=first_member["snippet_preview"],
                recommendation="Avoid shell execution or strictly validate the command input.",
                evidence_refs=[first_member["chunk_key"]],
                dataflow_or_controlflow_explanation="The route-facing chunk exposes user input to a sink.",
            ),
            {"input_tokens": 18, "output_tokens": 6, "total_tokens": 24},
            '{"decision":"confirmed"}',
        )

    if phase == AdkTraceEvent.Phase.REPO_SYNTHESIS:
        return (
            RepoSynthesisReport(
                summary="The scan confirmed one command injection hotspot.",
                hotspots=["app.py:1-2"],
                verified_findings=1,
                candidate_count=1,
            ),
            {"input_tokens": 7, "output_tokens": 3, "total_tokens": 10},
            '{"summary":"The scan confirmed one command injection hotspot."}',
        )

    raise AssertionError(f"Unexpected phase {phase}")
