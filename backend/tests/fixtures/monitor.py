import pytest


@pytest.fixture
def http_request_factory(db):
    from monitor.models import HttpRequest

    def _create(**kwargs):
        defaults = {
            "ip": "192.168.1.1",
            "method": "GET",
            "path": "/api/test",
            "status": 200,
            "user_agent": "Mozilla/5.0",
        }
        defaults.update(kwargs)
        return HttpRequest.objects.create(**defaults)

    return _create


@pytest.fixture
def analysis_factory(db):
    from monitor.models import AnalysisResult

    def _create(request_obj, **kwargs):
        defaults = {
            "threat_level": "safe",
            "threat_type": "none",
            "confidence": 0.95,
            "reason": "Normal traffic",
        }
        defaults.update(kwargs)
        return AnalysisResult.objects.create(request=request_obj, **defaults)

    return _create


@pytest.fixture
def alert_factory(db):
    from monitor.models import Alert

    def _create(request_obj, **kwargs):
        defaults = {
            "severity": "warning",
            "message": "Suspicious activity detected",
        }
        defaults.update(kwargs)
        return Alert.objects.create(request=request_obj, **defaults)

    return _create


@pytest.fixture
def gcp_service_factory(db):
    from monitor.models import GcpObservedService

    def _create(user, **kwargs):
        defaults = {
            "project_id": "test-project",
            "service_name": "test-service",
            "region": "us-central1",
        }
        defaults.update(kwargs)
        return GcpObservedService.objects.create(user=user, **defaults)

    return _create


@pytest.fixture
def gcp_event_factory(db):
    from django.utils import timezone as tz
    from monitor.models import GcpSecurityEvent

    def _create(user, **kwargs):
        defaults = {
            "source": "cloud_run_logs",
            "timestamp": tz.now(),
            "project_id": "test-project",
            "severity": "high",
            "category": "sql_injection",
        }
        defaults.update(kwargs)
        return GcpSecurityEvent.objects.create(user=user, **defaults)

    return _create


@pytest.fixture
def gcp_incident_factory(db):
    from django.utils import timezone as tz
    from monitor.models import GcpSecurityIncident

    def _create(user, **kwargs):
        defaults = {
            "project_id": "test-project",
            "incident_type": "attack_sqli_xss_traversal",
            "priority": "p1",
            "title": "Test Incident",
            "first_seen": tz.now(),
            "last_seen": tz.now(),
        }
        defaults.update(kwargs)
        return GcpSecurityIncident.objects.create(user=user, **defaults)

    return _create
