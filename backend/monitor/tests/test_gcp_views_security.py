import pytest


@pytest.fixture
def gcp_user(authenticated_client, user_settings_factory):
    user = authenticated_client._user
    user_settings_factory(user, gcp_project_id="test-project", gcp_service_account_key='{"type":"test"}')
    return authenticated_client


class TestGcpSecurityEvents:
    def test_lists_events(self, gcp_user, gcp_event_factory):
        user = gcp_user._user
        gcp_event_factory(user, severity="high", category="sql_injection")
        gcp_event_factory(user, severity="info", category="other")

        resp = gcp_user.get("/api/gcp-security/events/")
        data = resp.json()
        assert resp.status_code == 200
        assert data["count"] == 2
        assert len(data["results"]) == 2

    def test_severity_filter(self, gcp_user, gcp_event_factory):
        user = gcp_user._user
        gcp_event_factory(user, severity="high")
        gcp_event_factory(user, severity="info")

        resp = gcp_user.get("/api/gcp-security/events/?severity=high")
        data = resp.json()
        assert resp.status_code == 200
        assert data["count"] == 1
        assert data["results"][0]["severity"] == "high"

    def test_source_filter(self, gcp_user, gcp_event_factory):
        user = gcp_user._user
        gcp_event_factory(user, source="cloud_armor")
        gcp_event_factory(user, source="iam_audit")

        resp = gcp_user.get("/api/gcp-security/events/?source=cloud_armor")
        data = resp.json()
        assert resp.status_code == 200
        assert data["count"] == 1


class TestGcpSecurityIncidents:
    def test_lists_open_incidents(self, gcp_user, gcp_incident_factory):
        user = gcp_user._user
        gcp_incident_factory(user, status="open", title="Attack 1")
        gcp_incident_factory(user, status="resolved", title="Old")

        resp = gcp_user.get("/api/gcp-security/incidents/")
        data = resp.json()
        assert resp.status_code == 200
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
        incident = gcp_incident_factory(user)
        resp = gcp_user.get(f"/api/gcp-security/incidents/{incident.id}/")
        assert resp.status_code == 200
        assert resp.json()["id"] == incident.id

    def test_not_found(self, gcp_user):
        resp = gcp_user.get("/api/gcp-security/incidents/9999/")
        assert resp.status_code == 404


class TestGcpIncidentAck:
    def test_acknowledge(self, gcp_user, gcp_incident_factory):
        user = gcp_user._user
        incident = gcp_incident_factory(user, status="open")

        resp = gcp_user.post(f"/api/gcp-security/incidents/{incident.id}/ack/", {"status": "investigating"}, format="json")
        assert resp.status_code == 200
        assert resp.json()["status"] == "investigating"
        assert resp.json()["acknowledged_by"] == user.username


class TestGcpSecurityMap:
    def test_returns_geo_data(self, gcp_user, gcp_event_factory):
        user = gcp_user._user
        gcp_event_factory(user, severity="high", source_ip="1.2.3.4", country="US", geo_lat=37.0, geo_lng=-122.0)

        resp = gcp_user.get("/api/gcp-security/map/")
        data = resp.json()
        assert resp.status_code == 200
        assert len(data) == 1
        assert data[0]["country"] == "US"
        assert data[0]["count"] == 1
