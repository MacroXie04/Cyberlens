import pytest
from unittest.mock import MagicMock, patch


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
