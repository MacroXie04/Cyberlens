import pytest
from rest_framework.test import APIClient
from monitor.models import HttpRequest, AnalysisResult, Alert


@pytest.fixture
def api_client(authenticated_client):
    """Use authenticated client for all monitor tests."""
    return authenticated_client


@pytest.mark.django_db
class TestStatsOverview:
    def test_empty(self, api_client):
        resp = api_client.get("/api/stats/overview/")
        assert resp.status_code == 200
        assert resp.data["total_requests"] == 0
        assert resp.data["threats_detected"] == 0

    def test_with_data(self, api_client, http_request_factory, analysis_factory):
        req1 = http_request_factory()
        req2 = http_request_factory(ip="10.0.0.1")
        analysis_factory(req1, threat_level="safe")
        analysis_factory(req2, threat_level="malicious")
        resp = api_client.get("/api/stats/overview/")
        assert resp.data["total_requests"] == 2
        assert resp.data["ai_analyzed"] == 2
        assert resp.data["threats_detected"] == 1
        assert resp.data["malicious_count"] == 1


@pytest.mark.django_db
class TestStatsTimeline:
    def test_hourly_aggregation(self, api_client, http_request_factory):
        http_request_factory()
        http_request_factory(ip="10.0.0.1")
        resp = api_client.get("/api/stats/timeline/")
        assert resp.status_code == 200
        assert len(resp.data) >= 1
        assert "total" in resp.data[0]


@pytest.mark.django_db
class TestStatsGeo:
    def test_geo_data(self, api_client, http_request_factory):
        http_request_factory(geo_country="US", geo_lat=37.0, geo_lng=-122.0)
        http_request_factory(geo_country="US", geo_lat=37.0, geo_lng=-122.0)
        resp = api_client.get("/api/stats/geo/")
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]["count"] == 2


@pytest.mark.django_db
class TestHttpRequestViewSet:
    def test_list(self, api_client, http_request_factory):
        http_request_factory()
        resp = api_client.get("/api/requests/")
        assert resp.status_code == 200

    def test_threat_level_filter(self, api_client, http_request_factory, analysis_factory):
        req1 = http_request_factory()
        req2 = http_request_factory(ip="10.0.0.1")
        analysis_factory(req1, threat_level="safe")
        analysis_factory(req2, threat_level="malicious")
        resp = api_client.get("/api/requests/?threat_level=malicious")
        assert resp.status_code == 200
        results = resp.data.get("results", resp.data)
        assert len(results) == 1


@pytest.mark.django_db
class TestAlertViewSet:
    def test_list(self, api_client, http_request_factory, alert_factory):
        req = http_request_factory()
        alert_factory(req)
        resp = api_client.get("/api/alerts/")
        assert resp.status_code == 200

    def test_acknowledge(self, api_client, http_request_factory, alert_factory):
        req = http_request_factory()
        alert = alert_factory(req, acknowledged=False)
        resp = api_client.post(f"/api/alerts/{alert.id}/acknowledge/")
        assert resp.status_code == 200
        alert.refresh_from_db()
        assert alert.acknowledged is True


@pytest.mark.django_db
class TestVerifySession:
    def test_authenticated(self, api_client):
        resp = api_client.get("/api/verify-session/")
        assert resp.status_code == 200
        assert resp.data["status"] == "authenticated"

    def test_unauthenticated(self):
        client = APIClient()
        resp = client.get("/api/verify-session/")
        assert resp.status_code == 403


@pytest.mark.django_db
class TestUnauthenticated:
    """Verify monitor endpoints reject unauthenticated requests."""

    def test_stats_overview(self):
        client = APIClient()
        resp = client.get("/api/stats/overview/")
        assert resp.status_code == 403

    def test_requests_list(self):
        client = APIClient()
        resp = client.get("/api/requests/")
        assert resp.status_code == 403
