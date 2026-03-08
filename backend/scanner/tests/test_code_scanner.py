import pytest
from unittest.mock import patch

from scanner.models import (
    AdkTraceEvent,
    CodeFinding,
    CodeScanCandidate,
    CodeScanChunk,
    CodeScanFileIndex,
    GitHubScan,
)
from scanner.services.adk_code_pipeline import FULL_SCAN_PROFILE, _get_runtime_scan_profile
from scanner.services.code_scanner import (
    CandidateBatch,
    CandidateSpec,
    ChunkSummary,
    RepoSynthesisReport,
    VerificationDecision,
)


def _fake_structured_agent(*args, **kwargs):
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


@pytest.mark.django_db
class TestScanCodeSecurity:
    def test_runtime_scan_profile_disables_parallel_writes_on_sqlite(self):
        profile = _get_runtime_scan_profile(FULL_SCAN_PROFILE, database_vendor="sqlite")

        assert profile.mode == GitHubScan.Mode.FULL
        assert profile.github_fetch_workers == FULL_SCAN_PROFILE.github_fetch_workers
        assert profile.chunk_workers == 1
        assert profile.verification_workers == 1

    @patch("cyberlens.utils.get_google_api_key", return_value="")
    def test_no_api_key(self, mock_get_key):
        from scanner.services.code_scanner import scan_code_security

        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="url", scan_status="scanning")
        scan_code_security(scan.id, "/some/path")

        assert CodeFinding.objects.count() == 0
        assert AdkTraceEvent.objects.filter(scan=scan, kind="warning").count() == 1

    @patch("scanner.services.adk_code_pipeline.publish_code_scan_stream")
    @patch("scanner.services.local_client.get_source_files", return_value={})
    @patch("cyberlens.utils.probe_gemini_api_connection", return_value={"success": True, "message": "ok", "error_type": "", "status_code": 200})
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_no_source_files(self, mock_get_key, mock_probe, mock_get_files, mock_publish):
        from scanner.services.code_scanner import scan_code_security

        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="url", scan_status="scanning")
        scan_code_security(scan.id, "/some/path")

        assert CodeFinding.objects.count() == 0
        assert AdkTraceEvent.objects.filter(scan=scan, kind="warning").exists()
        assert AdkTraceEvent.objects.filter(scan=scan, phase="code_inventory", kind="stage_completed", status="warning").exists()

    @patch("scanner.services.adk_code_pipeline.publish_code_scan_stream")
    @patch("scanner.services.adk_code_pipeline._run_structured_agent", side_effect=_fake_structured_agent)
    @patch(
        "scanner.services.local_client.get_source_files",
        return_value={"app.py": "import os\nos.system(input())\n"},
    )
    @patch("cyberlens.utils.probe_gemini_api_connection", return_value={"success": True, "message": "ok", "error_type": "", "status_code": 200})
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_creates_trace_and_findings(
        self,
        mock_get_key,
        mock_probe,
        mock_get_files,
        mock_runner,
        mock_publish,
    ):
        from scanner.services.code_scanner import scan_code_security

        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="url", scan_status="scanning")
        scan_code_security(scan.id, "/some/path")

        assert CodeScanFileIndex.objects.filter(scan=scan).count() == 1
        assert CodeScanChunk.objects.filter(file_index__scan=scan).count() >= 1
        assert CodeScanCandidate.objects.filter(scan=scan).count() == 1
        assert CodeFinding.objects.filter(scan=scan).count() == 1

        scan.refresh_from_db()
        assert scan.code_scan_total_tokens > 0
        assert scan.code_scan_files_total == 1
        assert scan.code_scan_files_scanned == 1

        phases = set(AdkTraceEvent.objects.filter(scan=scan).values_list("phase", flat=True))
        assert {
            "code_inventory",
            "chunk_summary",
            "candidate_generation",
            "evidence_expansion",
            "verification",
            "repo_synthesis",
        }.issubset(phases)

        assert AdkTraceEvent.objects.filter(
            scan=scan, phase="verification", kind="artifact_created"
        ).exists()
        verification_event = AdkTraceEvent.objects.get(
            scan=scan, phase="verification", kind="artifact_created"
        )
        assert verification_event.payload_json["file_path"] == "app.py"
        assert verification_event.payload_json["line_number"] == 1
        assert verification_event.payload_json["title"] == "Command injection"
        assert "Avoid shell execution" in verification_event.payload_json["recommendation"]
        assert verification_event.payload_json["code_snippet"]
        assert AdkTraceEvent.objects.filter(
            scan=scan, phase="chunk_summary", kind="metric"
        ).exists()
        assert AdkTraceEvent.objects.filter(
            scan=scan, phase="candidate_generation", kind="metric"
        ).exists()
        assert AdkTraceEvent.objects.filter(
            scan=scan, phase="verification", kind="metric"
        ).exists()
        assert scan.code_scan_stats_json["phases"]["chunk_summary"]["completed_files"] == 1
        assert scan.code_scan_stats_json["phases"]["verification"]["reviewed_candidates"] == 1

    @patch("scanner.services.adk_code_pipeline.publish_code_scan_stream")
    @patch("scanner.services.adk_code_pipeline._run_structured_agent", side_effect=_fake_structured_agent)
    @patch("scanner.services.adk_code_pipeline.get_github_source_files", return_value={"main.py": "print('hi')"})
    @patch("cyberlens.utils.probe_gemini_api_connection", return_value={"success": True, "message": "ok", "error_type": "", "status_code": 200})
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_github_variant(
        self,
        mock_get_key,
        mock_probe,
        mock_get_files,
        mock_runner,
        mock_publish,
    ):
        from scanner.services.code_scanner import scan_code_security_github

        scan = GitHubScan.objects.create(repo_name="owner/repo", repo_url="url", scan_status="scanning")
        scan_code_security_github(scan.id, "ghp_token", "owner/repo")

        assert CodeScanFileIndex.objects.filter(scan=scan).count() == 1
        assert AdkTraceEvent.objects.filter(scan=scan, phase="repo_synthesis").exists()

    @patch("scanner.services.adk_code_pipeline._run_code_scan_pipeline")
    @patch("scanner.services.adk_code_pipeline.get_github_source_files", return_value={"main.py": "print('hi')"})
    @patch("cyberlens.utils.probe_gemini_api_connection", return_value={"success": True, "message": "ok", "error_type": "", "status_code": 200})
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_full_scan_uses_serial_workers_on_sqlite(
        self,
        mock_get_key,
        mock_probe,
        mock_get_files,
        mock_run_pipeline,
    ):
        from scanner.services.code_scanner import scan_code_security_github

        scan = GitHubScan.objects.create(
            repo_name="owner/repo",
            repo_url="url",
            scan_status="scanning",
            scan_mode=GitHubScan.Mode.FULL,
        )
        scan_code_security_github(scan.id, "ghp_token", "owner/repo")

        profile = mock_run_pipeline.call_args.args[2]
        assert profile.mode == GitHubScan.Mode.FULL
        assert profile.github_fetch_workers == FULL_SCAN_PROFILE.github_fetch_workers
        assert profile.chunk_workers == 1
        assert profile.verification_workers == 1
