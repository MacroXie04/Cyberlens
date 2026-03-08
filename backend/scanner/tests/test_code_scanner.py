import pytest
from unittest.mock import patch, MagicMock
from scanner.models import GitHubScan, CodeFinding


@pytest.mark.django_db
class TestScanCodeSecurity:
    @patch("cyberlens.utils.get_google_api_key", return_value="")
    def test_no_api_key(self, mock_get_key):
        from scanner.services.code_scanner import scan_code_security
        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="url", scan_status="scanning")
        scan_code_security(scan.id, "/some/path")
        assert CodeFinding.objects.count() == 0

    @patch("scanner.services.code_scanner.InMemoryRunner")
    @patch("scanner.services.code_scanner.get_local_source_files", return_value={})
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_no_source_files(self, mock_get_key, mock_get_files, mock_runner_cls):
        from scanner.services.code_scanner import scan_code_security
        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="url", scan_status="scanning")
        scan_code_security(scan.id, "/some/path")
        mock_runner_cls.assert_not_called()

    @patch("scanner.services.code_scanner.InMemoryRunner")
    @patch("scanner.services.code_scanner.get_local_source_files", return_value={"app.py": "import os\nos.system(input())"})
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_creates_findings(self, mock_get_key, mock_get_files, mock_runner_cls):
        mock_event = MagicMock()
        mock_event.is_final_response.return_value = True
        mock_event.content.parts = [MagicMock(text='{"findings": [{"file_path": "app.py", "line_number": 2, "severity": "critical", "category": "command_injection", "title": "OS Command Injection", "description": "User input passed to os.system", "code_snippet": "os.system(input())", "recommendation": "Use subprocess with shell=False"}], "summary": "Found 1 issue"}')]
        mock_runner = MagicMock()
        mock_runner.run.return_value = [mock_event]
        mock_runner_cls.return_value = mock_runner

        from scanner.services.code_scanner import scan_code_security
        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="url", scan_status="scanning")
        scan_code_security(scan.id, "/some/path")
        assert CodeFinding.objects.count() == 1
        finding = CodeFinding.objects.first()
        assert finding.category == "command_injection"

    @patch("scanner.services.code_scanner.InMemoryRunner", side_effect=Exception("AI down"))
    @patch("scanner.services.code_scanner.get_local_source_files", return_value={"app.py": "code"})
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_ai_failure_handled(self, mock_get_key, mock_get_files, mock_runner_cls):
        from scanner.services.code_scanner import scan_code_security
        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="url", scan_status="scanning")
        scan_code_security(scan.id, "/some/path")  # Should not raise
        assert CodeFinding.objects.count() == 0


@pytest.mark.django_db
class TestScanCodeSecurityGithub:
    @patch("scanner.services.code_scanner.InMemoryRunner")
    @patch("scanner.services.code_scanner.get_github_source_files", return_value={"main.py": "print('hi')"})
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_github_variant(self, mock_get_key, mock_get_files, mock_runner_cls):
        mock_event = MagicMock()
        mock_event.is_final_response.return_value = True
        mock_event.content.parts = [MagicMock(text='{"findings": [], "summary": "No issues found"}')]
        mock_runner = MagicMock()
        mock_runner.run.return_value = [mock_event]
        mock_runner_cls.return_value = mock_runner

        from scanner.services.code_scanner import scan_code_security_github
        scan = GitHubScan.objects.create(repo_name="owner/repo", repo_url="url", scan_status="scanning")
        scan_code_security_github(scan.id, "ghp_token", "owner/repo")
        # No findings created since response has empty findings
        assert CodeFinding.objects.count() == 0
