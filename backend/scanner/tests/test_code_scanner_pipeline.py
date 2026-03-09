from unittest.mock import patch

import pytest

from scanner.models import AdkTraceEvent, CodeFinding, CodeScanCandidate, CodeScanChunk, CodeScanFileIndex, GitHubScan

from .code_scanner_fakes import fake_structured_agent


@pytest.mark.django_db
class TestScanCodeSecurityPipeline:
    @patch("scanner.services.adk_code_pipeline.publish_code_scan_stream")
    @patch("scanner.services.adk_code_pipeline._run_structured_agent", side_effect=fake_structured_agent)
    @patch("scanner.services.local_client.get_source_files", return_value={"app.py": "import os\nos.system(input())\n"})
    @patch("cyberlens.utils.probe_gemini_api_connection", return_value={"success": True, "message": "ok", "error_type": "", "status_code": 200})
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_creates_trace_and_findings(self, mock_get_key, mock_probe, mock_get_files, mock_runner, mock_publish):
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
        assert {"code_inventory", "chunk_summary", "candidate_generation", "evidence_expansion", "verification", "repo_synthesis"}.issubset(phases)
        assert AdkTraceEvent.objects.filter(scan=scan, phase="verification", kind="artifact_created").exists()

        verification_event = AdkTraceEvent.objects.get(scan=scan, phase="verification", kind="artifact_created")
        assert verification_event.payload_json["file_path"] == "app.py"
        assert verification_event.payload_json["line_number"] == 1
        assert verification_event.payload_json["title"] == "Command injection"
        assert "Avoid shell execution" in verification_event.payload_json["recommendation"]
        assert verification_event.payload_json["code_snippet"]
        assert AdkTraceEvent.objects.filter(scan=scan, phase="chunk_summary", kind="metric").exists()
        assert AdkTraceEvent.objects.filter(scan=scan, phase="candidate_generation", kind="metric").exists()
        assert AdkTraceEvent.objects.filter(scan=scan, phase="verification", kind="metric").exists()
        assert scan.code_scan_stats_json["phases"]["chunk_summary"]["completed_files"] == 1
        assert scan.code_scan_stats_json["phases"]["verification"]["reviewed_candidates"] == 1

    @patch("scanner.services.adk_code_pipeline.publish_code_scan_stream")
    @patch("scanner.services.adk_code_pipeline._run_structured_agent", side_effect=fake_structured_agent)
    @patch("scanner.services.adk_code_pipeline.get_github_source_files", return_value={"main.py": "print('hi')"})
    @patch("cyberlens.utils.probe_gemini_api_connection", return_value={"success": True, "message": "ok", "error_type": "", "status_code": 200})
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_github_variant(self, mock_get_key, mock_probe, mock_get_files, mock_runner, mock_publish):
        from scanner.services.code_scanner import scan_code_security_github

        scan = GitHubScan.objects.create(repo_name="owner/repo", repo_url="url", scan_status="scanning")
        scan_code_security_github(scan.id, "ghp_token", "owner/repo")

        assert CodeScanFileIndex.objects.filter(scan=scan).count() == 1
        assert AdkTraceEvent.objects.filter(scan=scan, phase="repo_synthesis").exists()
