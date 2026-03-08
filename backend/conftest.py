import pytest
from unittest.mock import MagicMock, patch
from django.contrib.auth.models import User


@pytest.fixture
def user_factory(db):
    def _create(**kwargs):
        defaults = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpass123",
        }
        defaults.update(kwargs)
        password = defaults.pop("password")
        user = User.objects.create_user(password=password, **defaults)
        return user
    return _create


@pytest.fixture
def user_settings_factory(db):
    from accounts.models import UserSettings

    def _create(user, **kwargs):
        defaults = {}
        defaults.update(kwargs)
        settings_obj, _ = UserSettings.objects.get_or_create(user=user, defaults=defaults)
        if kwargs:
            for k, v in kwargs.items():
                setattr(settings_obj, k, v)
            settings_obj.save()
        return settings_obj
    return _create


@pytest.fixture
def authenticated_client(db, user_factory, user_settings_factory):
    from rest_framework.test import APIClient
    client = APIClient()
    user = user_factory()
    user_settings_factory(user)
    client.force_authenticate(user=user)
    client._user = user
    return client


@pytest.fixture
def scan_factory(db):
    from scanner.models import GitHubScan

    def _create(**kwargs):
        defaults = {
            "repo_name": "owner/test-repo",
            "repo_url": "https://github.com/owner/test-repo",
            "scan_source": "github",
            "scan_status": "completed",
        }
        defaults.update(kwargs)
        return GitHubScan.objects.create(**defaults)

    return _create


@pytest.fixture
def dependency_factory(db):
    from scanner.models import Dependency

    def _create(scan, **kwargs):
        defaults = {
            "name": "lodash",
            "version": "4.17.20",
            "ecosystem": "npm",
        }
        defaults.update(kwargs)
        return Dependency.objects.create(scan=scan, **defaults)

    return _create


@pytest.fixture
def vulnerability_factory(db):
    from scanner.models import Vulnerability

    def _create(dependency, **kwargs):
        defaults = {
            "cve_id": "CVE-2021-12345",
            "cvss_score": 7.5,
            "severity": "high",
            "summary": "Test vulnerability",
            "osv_id": "GHSA-test-1234",
        }
        defaults.update(kwargs)
        return Vulnerability.objects.create(dependency=dependency, **defaults)

    return _create


@pytest.fixture
def ai_report_factory(db):
    from scanner.models import AiReport

    def _create(scan, **kwargs):
        defaults = {
            "executive_summary": "Test report summary",
            "priority_ranking": [],
            "remediation_json": {"immediate": [], "short_term": [], "long_term": []},
        }
        defaults.update(kwargs)
        return AiReport.objects.create(scan=scan, **defaults)

    return _create


@pytest.fixture
def code_finding_factory(db):
    from scanner.models import CodeFinding

    def _create(scan, **kwargs):
        defaults = {
            "file_path": "src/app.py",
            "line_number": 10,
            "severity": "high",
            "category": "sql_injection",
            "title": "SQL Injection",
            "description": "User input used in SQL query",
        }
        defaults.update(kwargs)
        return CodeFinding.objects.create(scan=scan, **defaults)

    return _create


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
    from monitor.models import GcpSecurityEvent

    def _create(user, **kwargs):
        from django.utils import timezone as tz

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
    from monitor.models import GcpSecurityIncident

    def _create(user, **kwargs):
        from django.utils import timezone as tz

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


@pytest.fixture
def mock_redis():
    mock = MagicMock()
    with patch("monitor.services.redis_publisher._get_redis", return_value=mock):
        yield mock


@pytest.fixture(autouse=True)
def _use_locmem_cache(settings):
    """Use in-memory cache for tests instead of Redis."""
    settings.CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }
