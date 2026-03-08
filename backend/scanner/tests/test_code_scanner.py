import pytest
from unittest.mock import patch, MagicMock
from scanner.models import GitHubScan, CodeFinding


def _make_mock_event(text, is_final=True, partial=False, usage_metadata=None):
    """Create a mock ADK event."""
    mock_event = MagicMock()
    mock_event.is_final_response.return_value = is_final
    mock_event.partial = partial
    mock_event.content.parts = [MagicMock(text=text)]
    mock_event.usage_metadata = usage_metadata
    return mock_event


def _make_usage_metadata(prompt=100, candidates=50, total=150):
    meta = MagicMock()
    meta.prompt_token_count = prompt
    meta.candidates_token_count = candidates
    meta.total_token_count = total
    return meta


@pytest.mark.django_db
class TestScanCodeSecurity:
    @patch("cyberlens.utils.get_google_api_key", return_value="")
    def test_no_api_key(self, mock_get_key):
        from scanner.services.code_scanner import scan_code_security
        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="url", scan_status="scanning")
        scan_code_security(scan.id, "/some/path")
        assert CodeFinding.objects.count() == 0

    @patch("scanner.services.code_scanner.InMemoryRunner")
    @patch("scanner.services.local_client.get_source_files", return_value={})
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_no_source_files(self, mock_get_key, mock_get_files, mock_runner_cls):
        from scanner.services.code_scanner import scan_code_security
        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="url", scan_status="scanning")
        scan_code_security(scan.id, "/some/path")
        mock_runner_cls.assert_not_called()

    @patch("scanner.services.code_scanner.publish_code_scan_stream")
    @patch("scanner.services.code_scanner.time")
    @patch("scanner.services.code_scanner.InMemoryRunner")
    @patch("scanner.services.local_client.get_source_files", return_value={"app.py": "import os\nos.system(input())"})
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_creates_findings(self, mock_get_key, mock_get_files, mock_runner_cls, mock_time, mock_publish):
        finding_json = '{"findings": [{"file_path": "app.py", "line_number": 2, "severity": "critical", "category": "command_injection", "title": "OS Command Injection", "description": "User input passed to os.system", "code_snippet": "os.system(input())", "recommendation": "Use subprocess with shell=False"}], "summary": "Found 1 issue"}'
        usage = _make_usage_metadata()

        # Per-file scan event
        mock_event = _make_mock_event(finding_json, is_final=True, usage_metadata=usage)
        mock_runner = MagicMock()
        mock_runner.run.return_value = [mock_event]
        mock_runner_cls.return_value = mock_runner

        from scanner.services.code_scanner import scan_code_security
        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="url", scan_status="scanning")
        scan_code_security(scan.id, "/some/path")

        # Only 1 file, no cross-file analysis for single files
        assert CodeFinding.objects.count() == 1
        finding = CodeFinding.objects.first()
        assert finding.category == "command_injection"

        # Token tracking
        scan.refresh_from_db()
        assert scan.code_scan_input_tokens == 100
        assert scan.code_scan_output_tokens == 50
        assert scan.code_scan_total_tokens == 150
        assert scan.code_scan_files_scanned == 1

    @patch("scanner.services.code_scanner.publish_code_scan_stream")
    @patch("scanner.services.code_scanner.time")
    @patch("scanner.services.code_scanner.InMemoryRunner", side_effect=Exception("AI down"))
    @patch("scanner.services.local_client.get_source_files", return_value={"app.py": "code"})
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_ai_failure_handled(self, mock_get_key, mock_get_files, mock_runner_cls, mock_time, mock_publish):
        from scanner.services.code_scanner import scan_code_security
        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="url", scan_status="scanning")
        scan_code_security(scan.id, "/some/path")  # Should not raise
        assert CodeFinding.objects.count() == 0

        # file_error event should have been published
        error_calls = [c for c in mock_publish.call_args_list if c[0][0].get("type") == "file_error"]
        assert len(error_calls) == 1


@pytest.mark.django_db
class TestScanCodeSecurityGithub:
    @patch("scanner.services.code_scanner.publish_code_scan_stream")
    @patch("scanner.services.code_scanner.time")
    @patch("scanner.services.code_scanner.InMemoryRunner")
    @patch("scanner.services.code_scanner.get_github_source_files", return_value={"main.py": "print('hi')"})
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_github_variant(self, mock_get_key, mock_get_files, mock_runner_cls, mock_time, mock_publish):
        mock_event = _make_mock_event('{"findings": [], "summary": "No issues found"}')
        mock_runner = MagicMock()
        mock_runner.run.return_value = [mock_event]
        mock_runner_cls.return_value = mock_runner

        from scanner.services.code_scanner import scan_code_security_github
        scan = GitHubScan.objects.create(repo_name="owner/repo", repo_url="url", scan_status="scanning")
        scan_code_security_github(scan.id, "ghp_token", "owner/repo")
        assert CodeFinding.objects.count() == 0


@pytest.mark.django_db
class TestCrossFileAnalysis:
    @patch("scanner.services.code_scanner.publish_code_scan_stream")
    @patch("scanner.services.code_scanner.time")
    @patch("scanner.services.code_scanner.InMemoryRunner")
    @patch("scanner.services.local_client.get_source_files", return_value={
        "app.py": "from db import query\nquery(input())",
        "db.py": "def query(sql): cursor.execute(sql)",
    })
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_cross_file_runs_for_multiple_files(self, mock_get_key, mock_get_files, mock_runner_cls, mock_time, mock_publish):
        """Cross-file analysis should run when there are 2+ files."""
        mock_event = _make_mock_event('{"findings": [], "summary": "No issues"}')
        mock_runner = MagicMock()
        mock_runner.run.return_value = [mock_event]
        mock_runner_cls.return_value = mock_runner

        from scanner.services.code_scanner import scan_code_security
        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="url", scan_status="scanning")
        scan_code_security(scan.id, "/some/path")

        # InMemoryRunner should have been called 3 times: 2 per-file + 1 cross-file
        assert mock_runner_cls.call_count == 3
