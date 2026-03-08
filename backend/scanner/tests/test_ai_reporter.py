import pytest
from unittest.mock import patch, MagicMock
from scanner.models import GitHubScan, AiReport, Dependency, Vulnerability


@pytest.mark.django_db
class TestGenerateReport:
    @patch("cyberlens.utils.get_google_api_key", return_value="")
    def test_no_api_key(self, mock_get_key):
        from scanner.services.ai_reporter import generate_report
        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="url", scan_status="scanning")
        generate_report(scan)
        assert AiReport.objects.count() == 0

    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_no_vulns_creates_clean_report(self, mock_get_key, scan_factory):
        scan = scan_factory(scan_status="scanning")
        from scanner.services.ai_reporter import generate_report
        generate_report(scan)
        assert AiReport.objects.count() == 1
        report = AiReport.objects.first()
        assert "No vulnerabilities" in report.executive_summary
        scan.refresh_from_db()
        assert scan.security_score == 100

    @patch("scanner.services.ai_reporter.InMemoryRunner")
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_with_vulns(self, mock_get_key, mock_runner_cls, scan_factory, dependency_factory, vulnerability_factory):
        scan = scan_factory(scan_status="scanning")
        dep = dependency_factory(scan, is_vulnerable=True)
        vulnerability_factory(dep)

        # Mock the ADK runner to return a valid SecurityReport JSON
        mock_event = MagicMock()
        mock_event.is_final_response.return_value = True
        mock_event.content.parts = [MagicMock(text='{"security_score": 65, "executive_summary": "Found issues", "priority_ranking": [], "remediation": {"immediate": [], "short_term": [], "long_term": []}}')]
        mock_runner = MagicMock()
        mock_runner.run.return_value = [mock_event]
        mock_runner_cls.return_value = mock_runner

        from scanner.services.ai_reporter import generate_report
        generate_report(scan)

        assert AiReport.objects.count() == 1
        scan.refresh_from_db()
        assert scan.security_score == 65

    @patch("scanner.services.ai_reporter.InMemoryRunner", side_effect=Exception("AI down"))
    @patch("cyberlens.utils.get_google_api_key", return_value="test-key")
    def test_ai_failure_no_crash(self, mock_get_key, mock_runner_cls, scan_factory, dependency_factory, vulnerability_factory):
        scan = scan_factory(scan_status="scanning")
        dep = dependency_factory(scan, is_vulnerable=True)
        vulnerability_factory(dep)

        from scanner.services.ai_reporter import generate_report
        generate_report(scan)  # Should not raise
        assert AiReport.objects.count() == 0
