from datetime import timedelta

import pytest
from django.core.cache import cache
from django.utils import timezone as tz


@pytest.fixture
def gcp_user(authenticated_client, user_settings_factory):
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
        data = resp.json()
        assert resp.status_code == 200
        assert data["total_services"] == 2
        assert data["active_incidents"] == 2
        assert data["history_ready"] is True
        assert data["coverage_start"] is not None
        assert data["coverage_end"] is not None


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


class TestGcpEstateHistory:
    def test_timeline_returns_points_and_markers(self, gcp_user, gcp_service_factory, gcp_event_factory, gcp_incident_factory):
        from monitor.models import GcpServiceHealth

        user = gcp_user._user
        now = tz.now()
        service = gcp_service_factory(user, service_name="api", region="us-central1")
        GcpServiceHealth.objects.create(
            user=user,
            project_id="test-project",
            service_name=service.service_name,
            region=service.region,
            request_count=120,
            error_count=7,
            instance_count=2,
            bucket_start=now - timedelta(hours=1),
            bucket_end=now - timedelta(minutes=30),
        )
        gcp_event_factory(user, service="api", timestamp=now - timedelta(minutes=20), severity="high", category="sql_injection")
        gcp_incident_factory(user, title="SQLi burst", status="open", first_seen=now - timedelta(minutes=40), last_seen=now - timedelta(minutes=10), services_affected=["api"])

        resp = gcp_user.get("/api/gcp-estate/timeline/", {"start": (now - timedelta(hours=2)).isoformat(), "end": now.isoformat(), "bucket": "1h"})

        data = resp.json()
        assert resp.status_code == 200
        assert data["bucket"] == "1h"
        assert len(data["points"]) >= 2
        assert any(point["requests"] == 120 for point in data["points"])
        assert any(marker["kind"] == "event" for marker in data["markers"])
        assert any(marker["kind"] == "incident" for marker in data["markers"])
        assert data["history_ready"] is True
        assert data["coverage_start"] is not None
        assert data["coverage_end"] is not None

    def test_replay_snapshot_returns_summary_services_and_window_data(self, gcp_user, gcp_service_factory, gcp_event_factory, gcp_incident_factory):
        from monitor.models import GcpServiceHealth

        user = gcp_user._user
        now = tz.now()
        service = gcp_service_factory(user, service_name="api", region="us-central1")
        GcpServiceHealth.objects.create(
            user=user,
            project_id="test-project",
            service_name=service.service_name,
            region=service.region,
            request_count=80,
            error_count=4,
            latency_p50_ms=120,
            latency_p95_ms=240,
            instance_count=3,
            bucket_start=now - timedelta(minutes=65),
            bucket_end=now - timedelta(minutes=5),
        )
        event = gcp_event_factory(user, service="api", region="us-central1", source="cloud_armor", severity="high", category="armor_block", timestamp=now - timedelta(minutes=8))
        gcp_incident_factory(user, title="Armor spike", status="open", first_seen=now - timedelta(minutes=30), last_seen=now - timedelta(minutes=4), services_affected=["api"], regions_affected=["us-central1"])

        resp = gcp_user.get("/api/gcp-estate/replay-snapshot/", {"start": (now - timedelta(hours=2)).isoformat(), "end": now.isoformat(), "cursor": now.isoformat(), "window_minutes": 60, "service": "api", "region": "us-central1"})

        data = resp.json()
        assert resp.status_code == 200
        assert data["summary"]["project_id"] == "test-project"
        assert data["summary"]["history_ready"] is True
        assert len(data["services"]) == 1
        assert data["services"][0]["service_name"] == "api"
        assert data["services"][0]["sample_missing"] is False
        assert len(data["events"]) == 1
        assert data["events"][0]["id"] == event.id
        assert len(data["incidents"]) == 1
        assert data["perimeter"]["cloud_armor"] == 1
        assert data["history_status"]["history_ready"] is True

    def test_ensure_history_triggers_backfill_task(self, gcp_user, monkeypatch):
        from monitor.services import gcp_aggregator

        user = gcp_user._user
        cache.clear()
        calls = []

        def fake_delay(user_id, days):
            calls.append((user_id, days))

        monkeypatch.setattr(gcp_aggregator.gcp_backfill_history, "delay", fake_delay)

        resp = gcp_user.post("/api/gcp-estate/ensure-history/", {"days": 30}, format="json")

        assert resp.status_code == 200
        assert resp.json()["triggered"] is True
        assert calls == [(user.id, 30)]
