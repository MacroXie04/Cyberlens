from unittest.mock import patch

import pytest

from scanner.models import GitHubScan
from scanner.services.adk_code_pipeline import FULL_SCAN_PROFILE, _get_runtime_scan_profile


@pytest.mark.django_db
class TestScanCodeSecurityRuntime:
    def test_runtime_scan_profile_disables_parallel_writes_on_sqlite(self):
        profile = _get_runtime_scan_profile(FULL_SCAN_PROFILE, database_vendor="sqlite")

        assert profile.mode == GitHubScan.Mode.FULL
        assert profile.github_fetch_workers == FULL_SCAN_PROFILE.github_fetch_workers
        assert profile.chunk_workers == 1
        assert profile.verification_workers == 1

    @patch("cyberlens.utils.get_google_api_key", return_value="")
    def test_no_api_key(self, mock_get_key):
        from scanner.models import AdkTraceEvent, CodeFinding
        from scanner.services.code_scanner import scan_code_security

        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="url", scan_status="scanning")
        scan_code_security(scan.id, "/some/path")

        assert CodeFinding.objects.count() == 0
        assert AdkTraceEvent.objects.filter(scan=scan, kind="warning").count() == 1

    @patch("scanner.services.adk_code_pipeline.publish_code_scan_stream")
    @patch("scanner.services.clients.local_client.get_source_files", return_value={})
    @patch("cyberlens.utils.probe_gemini_api_connection", return_value={"success": True, "message": "ok", "error_type": "", "status_code": 200})
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_no_source_files(self, mock_get_key, mock_probe, mock_get_files, mock_publish):
        from scanner.models import AdkTraceEvent, CodeFinding
        from scanner.services.code_scanner import scan_code_security

        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="url", scan_status="scanning")
        scan_code_security(scan.id, "/some/path")

        assert CodeFinding.objects.count() == 0
        assert AdkTraceEvent.objects.filter(scan=scan, kind="warning").exists()
        assert AdkTraceEvent.objects.filter(scan=scan, phase="code_inventory", kind="stage_completed", status="warning").exists()

    @patch("scanner.services.adk_code_pipeline._run_code_scan_pipeline")
    @patch("scanner.services.adk_code_pipeline.get_github_source_files", return_value={"main.py": "print('hi')"})
    @patch("cyberlens.utils.probe_gemini_api_connection", return_value={"success": True, "message": "ok", "error_type": "", "status_code": 200})
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_full_scan_uses_serial_workers_on_sqlite(self, mock_get_key, mock_probe, mock_get_files, mock_run_pipeline):
        from scanner.services.code_scanner import scan_code_security_github

        scan = GitHubScan.objects.create(repo_name="owner/repo", repo_url="url", scan_status="scanning", scan_mode=GitHubScan.Mode.FULL)
        scan_code_security_github(scan.id, "ghp_token", "owner/repo")

        profile = mock_run_pipeline.call_args.args[2]
        assert profile.mode == GitHubScan.Mode.FULL
        assert profile.github_fetch_workers == FULL_SCAN_PROFILE.github_fetch_workers
        assert profile.chunk_workers == 1
        assert profile.verification_workers == 1
