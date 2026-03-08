import pytest
from django.utils import timezone as tz
from datetime import timedelta

from monitor.models import GcpSecurityEvent, GcpSecurityIncident
from monitor.services.gcp_rule_engine import evaluate_events, create_incidents


@pytest.fixture
def user(user_factory, user_settings_factory):
    u = user_factory()
    user_settings_factory(u, gcp_project_id="test-project")
    return u


class TestEvaluateEvents:
    def test_sqli_events_create_incident(self, user, gcp_event_factory):
        """SQL injection events above threshold should produce an incident."""
        events = [
            gcp_event_factory(user, category="sql_injection"),
            gcp_event_factory(user, category="sql_injection"),
            gcp_event_factory(user, category="sql_injection"),
        ]

        result = evaluate_events(user, "test-project", events)
        assert len(result) == 1
        assert result[0]["incident_type"] == "attack_sqli_xss_traversal"
        assert result[0]["priority"] == "p1"
        assert result[0]["evidence_count"] == 3

    def test_below_threshold_no_incident(self, user, gcp_event_factory):
        """Single SQL injection event is below threshold."""
        events = [gcp_event_factory(user, category="sql_injection")]

        result = evaluate_events(user, "test-project", events)
        assert len(result) == 0

    def test_armor_blocks_threshold(self, user, gcp_event_factory):
        """Cloud Armor blocks need 5 to trigger."""
        events = [
            gcp_event_factory(user, category="armor_block")
            for _ in range(5)
        ]

        result = evaluate_events(user, "test-project", events)
        assert len(result) == 1
        assert result[0]["incident_type"] == "armor_block_spike"

    def test_other_category_ignored(self, user, gcp_event_factory):
        """Events with 'other' category don't trigger incidents."""
        events = [gcp_event_factory(user, category="other") for _ in range(20)]
        result = evaluate_events(user, "test-project", events)
        assert len(result) == 0

    def test_merges_into_existing_incident(self, user, gcp_event_factory, gcp_incident_factory):
        """New events matching an open incident should merge, not create new."""
        existing = gcp_incident_factory(
            user,
            incident_type="attack_sqli_xss_traversal",
            status="open",
            last_seen=tz.now(),
            evidence_count=5,
        )
        events = [
            gcp_event_factory(user, category="sql_injection"),
            gcp_event_factory(user, category="sql_injection"),
        ]

        result = evaluate_events(user, "test-project", events)
        assert len(result) == 1
        assert result[0]["action"] == "updated"
        assert result[0]["incident_id"] == existing.id

        existing.refresh_from_db()
        assert existing.evidence_count == 7  # 5 + 2

    def test_iam_drift_single_event(self, user, gcp_event_factory):
        """IAM drift should trigger on a single event (threshold=1)."""
        events = [gcp_event_factory(user, category="iam_drift")]

        result = evaluate_events(user, "test-project", events)
        assert len(result) == 1
        assert result[0]["incident_type"] == "iam_permission_drift"


class TestCreateIncidents:
    def test_creates_incident(self, user, gcp_event_factory):
        events = [
            gcp_event_factory(user, category="bot_probing")
            for _ in range(5)
        ]
        incident_dicts = evaluate_events(user, "test-project", events)
        created = create_incidents(user, "test-project", incident_dicts)

        assert len(created) == 1
        assert created[0].incident_type == "bot_probing_campaign"
        assert GcpSecurityIncident.objects.filter(user=user).count() == 1

    def test_links_events_to_incident(self, user, gcp_event_factory):
        events = [
            gcp_event_factory(user, category="sql_injection")
            for _ in range(3)
        ]
        incident_dicts = evaluate_events(user, "test-project", events)
        created = create_incidents(user, "test-project", incident_dicts)

        linked = GcpSecurityEvent.objects.filter(incident=created[0]).count()
        assert linked == 3
