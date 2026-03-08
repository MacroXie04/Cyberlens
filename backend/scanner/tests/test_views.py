import pytest
from unittest.mock import patch
from rest_framework.test import APIClient
from scanner.models import GitHubScan, AiReport


@pytest.fixture
def api_client(authenticated_client):
    """Use authenticated client for all scanner tests."""
    return authenticated_client


@pytest.mark.django_db
class TestConnect:
    @patch("scanner.views.validate_token", return_value={"login": "testuser", "avatar_url": "https://img", "name": "Test"})
    def test_success(self, mock_validate, api_client):
        resp = api_client.post("/api/github/connect/", {"token": "ghp_valid"}, format="json")
        assert resp.status_code == 200
        assert resp.data["login"] == "testuser"

    def test_missing_token(self, api_client):
        resp = api_client.post("/api/github/connect/", {}, format="json")
        assert resp.status_code == 400

    @patch("scanner.views.validate_token", return_value=None)
    def test_invalid_token(self, mock_validate, api_client):
        resp = api_client.post("/api/github/connect/", {"token": "bad"}, format="json")
        assert resp.status_code == 401


@pytest.mark.django_db
class TestDisconnect:
    def test_success(self, api_client):
        resp = api_client.delete("/api/github/disconnect/")
        assert resp.status_code == 200
        assert resp.data["status"] == "disconnected"


@pytest.mark.django_db
class TestRepos:
    def test_not_connected(self, api_client):
        resp = api_client.get("/api/github/repos/")
        assert resp.status_code == 401

    @patch("scanner.views.list_repos", return_value=[{"full_name": "owner/repo", "name": "repo"}])
    @patch("scanner.views.validate_token", return_value={"login": "u", "avatar_url": "", "name": "U"})
    def test_success(self, mock_validate, mock_repos, api_client):
        # Connect first
        api_client.post("/api/github/connect/", {"token": "ghp_valid"}, format="json")
        resp = api_client.get("/api/github/repos/")
        assert resp.status_code == 200
        assert len(resp.data) == 1


@pytest.mark.django_db
class TestScan:
    def test_not_connected(self, api_client):
        resp = api_client.post("/api/github/scan/", {"repo": "owner/repo"}, format="json")
        assert resp.status_code == 401

    @patch("scanner.views.validate_token", return_value={"login": "u", "avatar_url": "", "name": "U"})
    def test_missing_repo(self, mock_validate, api_client):
        api_client.post("/api/github/connect/", {"token": "ghp_valid"}, format="json")
        resp = api_client.post("/api/github/scan/", {}, format="json")
        assert resp.status_code == 400

    @patch("scanner.views.run_full_scan")
    @patch("scanner.views.validate_token", return_value={"login": "u", "avatar_url": "", "name": "U"})
    def test_success(self, mock_validate, mock_run, api_client):
        mock_run.delay = lambda *a, **kw: None
        api_client.post("/api/github/connect/", {"token": "ghp_valid"}, format="json")
        resp = api_client.post("/api/github/scan/", {"repo": "owner/repo"}, format="json")
        assert resp.status_code == 202
        assert GitHubScan.objects.count() == 1


@pytest.mark.django_db
class TestScanDetail:
    def test_found(self, api_client, scan_factory):
        scan = scan_factory(user=api_client._user)
        resp = api_client.get(f"/api/github/scan/{scan.id}/")
        assert resp.status_code == 200
        assert resp.data["repo_name"] == "owner/test-repo"

    def test_not_found(self, api_client):
        resp = api_client.get("/api/github/scan/99999/")
        assert resp.status_code == 404

    def test_cannot_view_other_users_scan(self, api_client, scan_factory, user_factory):
        other_user = user_factory(username="other")
        scan = scan_factory(user=other_user)
        resp = api_client.get(f"/api/github/scan/{scan.id}/")
        assert resp.status_code == 404


@pytest.mark.django_db
class TestAiReport:
    def test_found(self, api_client, scan_factory, ai_report_factory):
        scan = scan_factory(user=api_client._user)
        ai_report_factory(scan, executive_summary="All clear")
        resp = api_client.get(f"/api/github/scan/{scan.id}/ai-report/")
        assert resp.status_code == 200
        assert resp.data["executive_summary"] == "All clear"

    def test_scan_not_found(self, api_client):
        resp = api_client.get("/api/github/scan/99999/ai-report/")
        assert resp.status_code == 404

    def test_report_not_generated_yet(self, api_client, scan_factory):
        scan = scan_factory(user=api_client._user)
        resp = api_client.get(f"/api/github/scan/{scan.id}/ai-report/")
        assert resp.status_code == 404


@pytest.mark.django_db
class TestCodeFindings:
    def test_found(self, api_client, scan_factory, code_finding_factory):
        scan = scan_factory(user=api_client._user)
        code_finding_factory(scan, title="XSS found")
        resp = api_client.get(f"/api/github/scan/{scan.id}/code-findings/")
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]["title"] == "XSS found"

    def test_scan_not_found(self, api_client):
        resp = api_client.get("/api/github/scan/99999/code-findings/")
        assert resp.status_code == 404


@pytest.mark.django_db
class TestUnauthenticated:
    """Verify that all endpoints reject unauthenticated requests."""

    def test_github_status(self):
        client = APIClient()
        resp = client.get("/api/github/status/")
        assert resp.status_code == 403

    def test_connect(self):
        client = APIClient()
        resp = client.post("/api/github/connect/", {"token": "ghp_x"}, format="json")
        assert resp.status_code == 403

    def test_settings(self):
        client = APIClient()
        resp = client.get("/api/settings/")
        assert resp.status_code == 403
