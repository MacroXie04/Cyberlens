from unittest.mock import patch

import pytest


@pytest.fixture
def api_client(authenticated_client):
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

    @patch("scanner.views.validate_token", return_value={"login": "u", "avatar_url": "", "name": "U"})
    @patch("scanner.views._dispatch_background_task")
    def test_success(self, mock_dispatch, mock_validate, api_client):
        from scanner.models import GitHubScan

        api_client.post("/api/github/connect/", {"token": "ghp_valid"}, format="json")
        resp = api_client.post("/api/github/scan/", {"repo": "owner/repo"}, format="json")
        assert resp.status_code == 202
        assert GitHubScan.objects.count() == 1
        scan = GitHubScan.objects.get()
        assert mock_dispatch.call_args.args[1] == scan.id

    @patch("scanner.views.validate_token", return_value={"login": "u", "avatar_url": "", "name": "U"})
    @patch("scanner.views._dispatch_background_task")
    def test_defaults_to_fast_scan_mode(self, mock_dispatch, mock_validate, api_client):
        from scanner.models import GitHubScan

        api_client.post("/api/github/connect/", {"token": "ghp_valid"}, format="json")
        resp = api_client.post("/api/github/scan/", {"repo": "owner/repo"}, format="json")
        assert resp.status_code == 202
        scan = GitHubScan.objects.get()
        assert scan.scan_mode == "fast"
        assert mock_dispatch.call_args.kwargs["scan_mode"] == "fast"

    @patch("scanner.views.validate_token", return_value={"login": "u", "avatar_url": "", "name": "U"})
    @patch("scanner.views._dispatch_background_task")
    def test_accepts_full_scan_mode(self, mock_dispatch, mock_validate, api_client):
        from scanner.models import GitHubScan

        api_client.post("/api/github/connect/", {"token": "ghp_valid"}, format="json")
        resp = api_client.post("/api/github/scan/", {"repo": "owner/repo", "scan_mode": "full"}, format="json")
        assert resp.status_code == 202
        scan = GitHubScan.objects.get()
        assert scan.scan_mode == "full"
        assert mock_dispatch.call_args.kwargs["scan_mode"] == "full"
