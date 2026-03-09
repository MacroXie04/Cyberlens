from unittest.mock import Mock, patch

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from scanner.views import _dispatch_background_task, _run_eager_task_in_thread


@pytest.mark.django_db
class TestUnauthenticated:
    def test_github_status(self):
        client = APIClient()
        resp = client.get("/api/github/status/")
        assert resp.status_code == 403

    def test_connect(self):
        client = APIClient()
        resp = client.post("/api/github/connect/", {"token": "ghp_x"}, format="json")
        assert resp.status_code == 403

    def test_repos(self):
        client = APIClient()
        resp = client.get("/api/github/repos/")
        assert resp.status_code == 403

    def test_scan(self):
        client = APIClient()
        resp = client.post("/api/github/scan/", {"repo": "owner/repo"}, format="json")
        assert resp.status_code == 403

    def test_scans(self):
        client = APIClient()
        resp = client.get("/api/github/scans/?repo=owner/repo")
        assert resp.status_code == 403

    def test_scan_detail(self):
        client = APIClient()
        resp = client.get("/api/github/scan/1/")
        assert resp.status_code == 403

    def test_ai_report(self):
        client = APIClient()
        resp = client.get("/api/github/scan/1/ai-report/")
        assert resp.status_code == 403

    def test_code_findings(self):
        client = APIClient()
        resp = client.get("/api/github/scan/1/code-findings/")
        assert resp.status_code == 403

    def test_adk_trace(self):
        client = APIClient()
        resp = client.get("/api/github/scan/1/adk-trace/")
        assert resp.status_code == 403

    def test_status(self):
        client = APIClient()
        resp = client.get("/api/github/status/")
        assert resp.status_code == 403

    def test_settings(self):
        client = APIClient()
        resp = client.get("/api/settings/")
        assert resp.status_code == 403


class TestDispatchBackgroundTask:
    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    @patch("scanner.views.threading.Thread")
    def test_eager_mode_uses_background_thread(self, mock_thread_cls):
        task = Mock()
        task.name = "scanner.services.osv_scanner.run_full_scan"

        _dispatch_background_task(task, 1, "ghp_test", "owner/repo", user_id=7)

        mock_thread_cls.assert_called_once_with(
            target=_run_eager_task_in_thread,
            args=(task, (1, "ghp_test", "owner/repo"), {"user_id": 7}),
            daemon=True,
            name="scanner.services.osv_scanner.run_full_scan-thread",
        )
        mock_thread_cls.return_value.start.assert_called_once()
        task.delay.assert_not_called()

    @override_settings(CELERY_TASK_ALWAYS_EAGER=False)
    def test_non_eager_uses_celery_delay(self):
        task = Mock()
        task.name = "scanner.services.osv_scanner.run_full_scan"

        _dispatch_background_task(task, 1, "ghp_test", "owner/repo", user_id=7)

        task.delay.assert_called_once_with(1, "ghp_test", "owner/repo", user_id=7)
