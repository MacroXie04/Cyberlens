import pytest
import responses
from unittest.mock import patch, MagicMock
from scanner.services.scanning.osv_scanner import _classify_severity, query_osv, _run_scan_pipeline, run_full_scan, run_local_scan
from scanner.models import GitHubScan, Dependency, Vulnerability


class TestClassifySeverity:
    def test_zero(self):
        assert _classify_severity(0.0) == ""

    def test_low(self):
        assert _classify_severity(0.5) == "low"

    def test_medium(self):
        assert _classify_severity(4.0) == "medium"

    def test_high(self):
        assert _classify_severity(7.0) == "high"

    def test_critical(self):
        assert _classify_severity(9.0) == "critical"

    def test_critical_high(self):
        assert _classify_severity(9.5) == "critical"


class TestQueryOsv:
    @responses.activate
    def test_success(self):
        responses.post(
            "https://api.osv.dev/v1/querybatch",
            json={"results": [{"vulns": [{"id": "GHSA-1234"}]}]},
            status=200,
        )
        result = query_osv([{"name": "lodash", "ecosystem": "npm", "version": "4.17.20"}])
        assert len(result) == 1
        assert result[0]["vulns"][0]["id"] == "GHSA-1234"

    @responses.activate
    def test_correct_payload(self):
        responses.post("https://api.osv.dev/v1/querybatch", json={"results": []}, status=200)
        query_osv([{"name": "django", "ecosystem": "PyPI", "version": "4.0"}])
        body = responses.calls[0].request.body
        import json
        payload = json.loads(body)
        assert payload["queries"][0]["package"]["name"] == "django"
        assert payload["queries"][0]["version"] == "4.0"

    @responses.activate
    def test_api_error_returns_empty(self):
        responses.post("https://api.osv.dev/v1/querybatch", status=500)
        result = query_osv([{"name": "lodash", "ecosystem": "npm"}])
        assert result == []

    @responses.activate
    def test_timeout_returns_empty(self):
        import requests as req_lib
        responses.post(
            "https://api.osv.dev/v1/querybatch",
            body=req_lib.ConnectionError("timeout"),
        )
        result = query_osv([{"name": "lodash", "ecosystem": "npm"}])
        assert result == []


@pytest.mark.django_db
class TestRunScanPipeline:
    @patch("scanner.services.code_scanner.scan_code_security")
    @patch("scanner.services.scanning.osv_scanner.scan_code_security_github")
    @patch("scanner.services.scanning.osv_scanner.generate_report")
    @patch("scanner.services.scanning.osv_scanner.publish_scan_complete")
    @patch("scanner.services.scanning.osv_scanner.publish_scan_progress")
    def test_empty_dep_files_marks_completed(self, mock_progress, mock_complete, mock_report, mock_gh_code, mock_local_code):
        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="https://github.com/test/repo", scan_status="scanning")
        _run_scan_pipeline(scan.id, {})
        scan.refresh_from_db()
        assert scan.scan_status == "completed"
        mock_report.assert_called_once()
        mock_complete.assert_called_once()

    @patch("scanner.services.code_scanner.scan_code_security")
    @patch("scanner.services.scanning.osv_scanner.scan_code_security_github")
    @patch("scanner.services.scanning.osv_scanner.generate_report")
    @patch("scanner.services.scanning.osv_scanner.publish_scan_complete")
    @patch("scanner.services.scanning.osv_scanner.publish_scan_progress")
    def test_empty_dep_files_still_runs_github_code_scan(
        self,
        mock_progress,
        mock_complete,
        mock_report,
        mock_gh_code,
        mock_local_code,
    ):
        scan = GitHubScan.objects.create(
            repo_name="test/repo",
            repo_url="https://github.com/test/repo",
            scan_status="scanning",
        )

        _run_scan_pipeline(scan.id, {}, pat="ghp_test", repo_full_name="test/repo", user_id=123)

        scan.refresh_from_db()
        assert scan.scan_status == "completed"
        mock_report.assert_called_once()
        mock_gh_code.assert_called_once_with(scan.id, "ghp_test", "test/repo", user_id=123)

    @responses.activate
    @patch("scanner.services.code_scanner.scan_code_security")
    @patch("scanner.services.scanning.osv_scanner.scan_code_security_github")
    @patch("scanner.services.scanning.osv_scanner.generate_report")
    @patch("scanner.services.scanning.osv_scanner.publish_scan_complete")
    @patch("scanner.services.scanning.osv_scanner.publish_scan_progress")
    def test_full_flow_creates_records(self, mock_progress, mock_complete, mock_report, mock_gh_code, mock_local_code):
        responses.post(
            "https://api.osv.dev/v1/querybatch",
            json={"results": [{"vulns": [{"id": "GHSA-1234", "summary": "Test vuln", "aliases": ["CVE-2024-0001"]}]}]},
        )
        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="https://github.com/test/repo", scan_status="scanning")
        dep_files = {"requirements.txt": "django==5.0\n"}
        _run_scan_pipeline(scan.id, dep_files)

        scan.refresh_from_db()
        assert scan.scan_status == "completed"
        assert scan.total_deps == 1
        assert scan.vulnerable_deps == 1
        assert Dependency.objects.filter(scan=scan).count() == 1
        assert Vulnerability.objects.filter(dependency__scan=scan).count() == 1

    @responses.activate
    @patch("scanner.services.code_scanner.scan_code_security")
    @patch("scanner.services.scanning.osv_scanner.scan_code_security_github")
    @patch("scanner.services.scanning.osv_scanner.generate_report")
    @patch("scanner.services.scanning.osv_scanner.publish_scan_complete")
    @patch("scanner.services.scanning.osv_scanner.publish_scan_progress")
    def test_deduplicates_deps(self, mock_progress, mock_complete, mock_report, mock_gh_code, mock_local_code):
        responses.post("https://api.osv.dev/v1/querybatch", json={"results": [{"vulns": []}]})
        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="https://github.com/test/repo", scan_status="scanning")
        # Two files listing same dep
        dep_files = {
            "requirements.txt": "django==5.0\n",
            "pyproject.toml": 'dependencies = [\n    "django>=5.0",\n]\n',
        }
        _run_scan_pipeline(scan.id, dep_files)
        assert Dependency.objects.filter(scan=scan, name="django").count() == 1


@pytest.mark.django_db
class TestRunFullScan:
    @patch("scanner.services.scanning.osv_scanner.publish_scan_complete")
    @patch("scanner.services.scanning.osv_scanner.publish_scan_progress")
    @patch("scanner.services.scanning.osv_scanner._run_scan_pipeline", side_effect=Exception("boom"))
    @patch("scanner.services.scanning.osv_scanner.get_dependency_files")
    def test_exception_sets_failed(self, mock_get_deps, mock_pipeline, mock_progress, mock_complete):
        scan = GitHubScan.objects.create(repo_name="test/repo", repo_url="https://github.com/test/repo", scan_status="scanning")
        run_full_scan(scan.id, "fake-pat", "test/repo")
        scan.refresh_from_db()
        assert scan.scan_status == "failed"


@pytest.mark.django_db
class TestRunLocalScan:
    @patch("scanner.services.scanning.osv_scanner.publish_scan_complete")
    @patch("scanner.services.scanning.osv_scanner.publish_scan_progress")
    @patch("scanner.services.scanning.osv_scanner._run_scan_pipeline", side_effect=Exception("boom"))
    @patch("scanner.services.clients.local_client.get_local_dependency_files")
    def test_exception_sets_failed(self, mock_get_deps, mock_pipeline, mock_progress, mock_complete):
        scan = GitHubScan.objects.create(repo_name="local:myproj", repo_url="/scan-targets/myproj", scan_status="scanning")
        run_local_scan(scan.id, "/scan-targets/myproj")
        scan.refresh_from_db()
        assert scan.scan_status == "failed"
