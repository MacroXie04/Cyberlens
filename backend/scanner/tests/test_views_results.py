import pytest

from scanner.models import AdkTraceEvent


@pytest.fixture
def api_client(authenticated_client):
    return authenticated_client


@pytest.mark.django_db
class TestScansList:
    def test_requires_repo_query_param(self, api_client):
        resp = api_client.get("/api/github/scans/")
        assert resp.status_code == 400

    def test_returns_repo_scoped_history_for_current_user(self, api_client, scan_factory, code_finding_factory, user_factory):
        older = scan_factory(user=api_client._user, repo_name="owner/repo", scan_status="failed")
        newest = scan_factory(user=api_client._user, repo_name="owner/repo", scan_status="completed")
        code_finding_factory(newest)
        other_repo = scan_factory(user=api_client._user, repo_name="owner/other")
        other_user = user_factory(username="other-user")
        scan_factory(user=other_user, repo_name="owner/repo")

        resp = api_client.get("/api/github/scans/?repo=owner/repo")

        assert resp.status_code == 200
        assert [item["id"] for item in resp.data] == [newest.id, older.id]
        assert all(item["repo_name"] == "owner/repo" for item in resp.data)
        assert resp.data[0]["code_findings_count"] == 1
        assert resp.data[0]["scan_mode"] == "fast"
        assert other_repo.id not in [item["id"] for item in resp.data]


@pytest.mark.django_db
class TestScanDetail:
    def test_found(self, api_client, scan_factory):
        scan = scan_factory(user=api_client._user)
        resp = api_client.get(f"/api/github/scan/{scan.id}/")
        assert resp.status_code == 200
        assert resp.data["repo_name"] == "owner/test-repo"

    def test_token_fields_returned(self, api_client, scan_factory):
        scan = scan_factory(
            user=api_client._user,
            scan_mode="full",
            code_scan_input_tokens=1200,
            code_scan_output_tokens=800,
            code_scan_total_tokens=2000,
            code_scan_files_scanned=5,
            code_scan_files_total=10,
        )
        resp = api_client.get(f"/api/github/scan/{scan.id}/")
        assert resp.status_code == 200
        assert resp.data["scan_mode"] == "full"
        assert resp.data["code_scan_input_tokens"] == 1200
        assert resp.data["code_scan_output_tokens"] == 800
        assert resp.data["code_scan_total_tokens"] == 2000
        assert resp.data["code_scan_files_scanned"] == 5
        assert resp.data["code_scan_files_total"] == 10

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

    def test_explanation_field_returned(self, api_client, scan_factory, code_finding_factory):
        scan = scan_factory(user=api_client._user)
        code_finding_factory(scan, title="SQL Injection", explanation="User input flows from line 10 to line 15 unsanitized.")
        resp = api_client.get(f"/api/github/scan/{scan.id}/code-findings/")
        assert resp.status_code == 200
        assert resp.data[0]["explanation"] == "User input flows from line 10 to line 15 unsanitized."

    def test_scan_not_found(self, api_client):
        resp = api_client.get("/api/github/scan/99999/code-findings/")
        assert resp.status_code == 404


@pytest.mark.django_db
class TestAdkTrace:
    def test_found(self, api_client, scan_factory):
        scan = scan_factory(user=api_client._user)
        AdkTraceEvent.objects.create(
            scan=scan,
            sequence=1,
            phase="dependency_input",
            kind="stage_started",
            status="running",
            label="Build dependency input",
        )
        resp = api_client.get(f"/api/github/scan/{scan.id}/adk-trace/")
        assert resp.status_code == 200
        assert "phases" in resp.data
        assert "events" in resp.data
        assert "artifacts" in resp.data
        assert resp.data["events"][0]["phase"] == "dependency_input"

    def test_scan_not_found(self, api_client):
        resp = api_client.get("/api/github/scan/99999/adk-trace/")
        assert resp.status_code == 404
