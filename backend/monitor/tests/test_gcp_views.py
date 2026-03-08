import pytest
from django.utils import timezone as tz
from datetime import timedelta


@pytest.fixture
def gcp_user(authenticated_client, user_settings_factory):
    """An authenticated client with GCP settings configured."""
    user = authenticated_client._user
    user_settings_factory(user, gcp_project_id="test-project", gcp_service_account_key='{"type":"test"}')
    return authenticated_client


class TestGcpEstateSummary:
    def test_no_config_returns_error(self, authenticated_client):
        resp = authenticated_client.get("/api/gcp-estate/summary/")
        assert resp.status_code == 400

    def test_empty_estate(self, gcp_user):
        resp = gcp_user.get("/api/gcp-estate/summary/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["project_id"] == "test-project"
        assert data["active_incidents"] == 0
        assert data["total_services"] == 0

    def test_with_services_and_incidents(self, gcp_user, gcp_service_factory, gcp_incident_factory):
        user = gcp_user._user
        gcp_service_factory(user, service_name="svc-a")
        gcp_service_factory(user, service_name="svc-b")
        gcp_incident_factory(user, status="open")
        gcp_incident_factory(user, status="investigating")
        gcp_incident_factory(user, status="resolved")

        resp = gcp_user.get("/api/gcp-estate/summary/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_services"] == 2
        assert data["active_incidents"] == 2  # open + investigating


class TestGcpEstateServices:
    def test_lists_services(self, gcp_user, gcp_service_factory):
        user = gcp_user._user
        gcp_service_factory(user, service_name="api")
        gcp_service_factory(user, service_name="web")

        resp = gcp_user.get("/api/gcp-estate/services/")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_empty_list(self, gcp_user):
        resp = gcp_user.get("/api/gcp-estate/services/")
        assert resp.status_code == 200
        assert resp.json() == []


class TestGcpSecurityEvents:
    def test_lists_events(self, gcp_user, gcp_event_factory):
        user = gcp_user._user
        gcp_event_factory(user, severity="high", category="sql_injection")
        gcp_event_factory(user, severity="info", category="other")

        resp = gcp_user.get("/api/gcp-security/events/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 2
        assert len(data["results"]) == 2

    def test_severity_filter(self, gcp_user, gcp_event_factory):
        user = gcp_user._user
        gcp_event_factory(user, severity="high")
        gcp_event_factory(user, severity="info")

        resp = gcp_user.get("/api/gcp-security/events/?severity=high")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        assert data["results"][0]["severity"] == "high"

    def test_source_filter(self, gcp_user, gcp_event_factory):
        user = gcp_user._user
        gcp_event_factory(user, source="cloud_armor")
        gcp_event_factory(user, source="iam_audit")

        resp = gcp_user.get("/api/gcp-security/events/?source=cloud_armor")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1


class TestGcpSecurityIncidents:
    def test_lists_open_incidents(self, gcp_user, gcp_incident_factory):
        user = gcp_user._user
        gcp_incident_factory(user, status="open", title="Attack 1")
        gcp_incident_factory(user, status="resolved", title="Old")

        resp = gcp_user.get("/api/gcp-security/incidents/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["title"] == "Attack 1"

    def test_status_filter(self, gcp_user, gcp_incident_factory):
        user = gcp_user._user
        gcp_incident_factory(user, status="resolved", title="Resolved")

        resp = gcp_user.get("/api/gcp-security/incidents/?status=resolved")
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestGcpIncidentDetail:
    def test_found(self, gcp_user, gcp_incident_factory):
        user = gcp_user._user
        inc = gcp_incident_factory(user)
        resp = gcp_user.get(f"/api/gcp-security/incidents/{inc.id}/")
        assert resp.status_code == 200
        assert resp.json()["id"] == inc.id

    def test_not_found(self, gcp_user):
        resp = gcp_user.get("/api/gcp-security/incidents/9999/")
        assert resp.status_code == 404


class TestGcpIncidentAck:
    def test_acknowledge(self, gcp_user, gcp_incident_factory):
        user = gcp_user._user
        inc = gcp_incident_factory(user, status="open")

        resp = gcp_user.post(
            f"/api/gcp-security/incidents/{inc.id}/ack/",
            {"status": "investigating"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "investigating"
        assert resp.json()["acknowledged_by"] == user.username


class TestGcpSecurityMap:
    def test_returns_geo_data(self, gcp_user, gcp_event_factory):
        user = gcp_user._user
        gcp_event_factory(
            user,
            severity="high",
            source_ip="1.2.3.4",
            country="US",
            geo_lat=37.0,
            geo_lng=-122.0,
        )

        resp = gcp_user.get("/api/gcp-security/map/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["country"] == "US"
        assert data[0]["count"] == 1


class TestGcpUnauthenticated:
    def test_estate_summary(self, client):
        resp = client.get("/api/gcp-estate/summary/")
        assert resp.status_code in (401, 403)

    def test_security_events(self, client):
        resp = client.get("/api/gcp-security/events/")
        assert resp.status_code in (401, 403)
