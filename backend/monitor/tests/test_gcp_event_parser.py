import pytest
from monitor.services.gcp_event_parser import (
    parse_cloud_run_log,
    parse_cloud_armor_log,
    parse_iam_audit_log,
    parse_iap_log,
    parse_load_balancer_log,
    _classify_message,
    _map_gcp_severity,
)


class TestGcpSeverityMapping:
    def test_default(self):
        assert _map_gcp_severity("DEFAULT") == "info"

    def test_error(self):
        assert _map_gcp_severity("ERROR") == "high"

    def test_critical(self):
        assert _map_gcp_severity("CRITICAL") == "critical"

    def test_warning(self):
        assert _map_gcp_severity("WARNING") == "medium"


class TestClassifyMessage:
    def test_sql_injection(self):
        assert _classify_message("SELECT * FROM users WHERE id=1 OR 1=1", "", None) == "sql_injection"

    def test_xss(self):
        assert _classify_message("<script>alert(1)</script>", "", None) == "xss"

    def test_path_traversal(self):
        assert _classify_message("GET /../../../etc/passwd", "", None) == "path_traversal"

    def test_bot_probing(self):
        assert _classify_message("User-Agent: sqlmap/1.5", "", None) == "bot_probing"

    def test_credential_abuse(self):
        assert _classify_message("Failed login attempt for user admin", "", None) == "credential_abuse"

    def test_rate_limit(self):
        assert _classify_message("OK", "", 429) == "rate_limit"

    def test_error_surge(self):
        assert _classify_message("Internal server error", "ERROR", 500) == "error_surge"

    def test_normal_message(self):
        assert _classify_message("GET /api/health 200 OK", "", 200) == "other"


class TestParseCloudRunLog:
    def test_basic_log(self):
        entry = {
            "timestamp": "2026-03-07T10:00:00Z",
            "severity": "INFO",
            "message": "Request received",
            "resource": {
                "type": "cloud_run_revision",
                "labels": {
                    "service_name": "api",
                    "location": "us-central1",
                    "revision_name": "api-00001-abc",
                },
            },
            "trace": "projects/test/traces/abc123",
            "http_request": None,
        }
        result = parse_cloud_run_log(entry, "test-project")
        assert result is not None
        assert result["source"] == "cloud_run_logs"
        assert result["service"] == "api"
        assert result["region"] == "us-central1"

    def test_sqli_escalates_severity(self):
        entry = {
            "timestamp": "2026-03-07T10:00:00Z",
            "severity": "INFO",
            "message": "GET /api?q=1 OR 1=1",
            "resource": {"type": "cloud_run_revision", "labels": {}},
            "trace": "",
            "http_request": None,
        }
        result = parse_cloud_run_log(entry, "test-project")
        assert result["category"] == "sql_injection"
        assert result["severity"] == "high"

    def test_with_http_request(self):
        entry = {
            "timestamp": "2026-03-07T10:00:00Z",
            "severity": "ERROR",
            "message": "500 error",
            "resource": {"type": "cloud_run_revision", "labels": {}},
            "trace": "",
            "http_request": {
                "remoteIp": "1.2.3.4",
                "requestUrl": "/api/test",
                "requestMethod": "POST",
                "status": 500,
            },
        }
        result = parse_cloud_run_log(entry, "test-project")
        assert result["source_ip"] == "1.2.3.4"
        assert result["method"] == "POST"
        assert result["status_code"] == 500


class TestParseCloudArmorLog:
    def test_basic_armor_event(self):
        entry = {
            "timestamp": "2026-03-07T10:00:00Z",
            "severity": "WARNING",
            "message": "Cloud Armor blocked request",
            "resource": {"type": "http_load_balancer", "labels": {"zone": "us-central1"}},
            "trace": "",
            "raw": {
                "jsonPayload": {
                    "enforcedSecurityPolicy": {
                        "name": "my-policy",
                        "priority": "1000",
                        "outcome": "DENY",
                        "configuredAction": "deny(403)",
                    }
                },
                "httpRequest": {
                    "remoteIp": "5.6.7.8",
                    "requestUrl": "/admin",
                    "requestMethod": "GET",
                    "status": 403,
                },
            },
        }
        result = parse_cloud_armor_log(entry, "test-project")
        assert result["source"] == "cloud_armor"
        assert result["category"] == "armor_block"
        assert result["severity"] == "high"
        assert result["source_ip"] == "5.6.7.8"
        assert result["fact_fields"]["policy_name"] == "my-policy"


class TestParseIamAuditLog:
    def test_permission_change(self):
        entry = {
            "timestamp": "2026-03-07T10:00:00Z",
            "severity": "NOTICE",
            "message": "IAM policy updated",
            "resource": {"type": "project", "labels": {}},
            "trace": "",
            "raw": {
                "protoPayload": {
                    "authenticationInfo": {"principalEmail": "admin@test.com"},
                    "methodName": "SetIamPolicy",
                    "resourceName": "projects/test",
                    "serviceName": "iam.googleapis.com",
                }
            },
        }
        result = parse_iam_audit_log(entry, "test-project")
        assert result["category"] == "iam_drift"
        assert result["severity"] == "high"
        assert result["principal"] == "admin@test.com"

    def test_read_operation(self):
        entry = {
            "timestamp": "2026-03-07T10:00:00Z",
            "severity": "INFO",
            "message": "IAM policy read",
            "resource": {"type": "project", "labels": {}},
            "trace": "",
            "raw": {
                "protoPayload": {
                    "authenticationInfo": {"principalEmail": "user@test.com"},
                    "methodName": "GetIamPolicy",
                    "resourceName": "projects/test",
                    "serviceName": "iam.googleapis.com",
                }
            },
        }
        result = parse_iam_audit_log(entry, "test-project")
        assert result["category"] == "other"  # Read ops are not IAM drift
        assert result["severity"] == "info"


class TestParseIapLog:
    def test_error_escalates(self):
        entry = {
            "timestamp": "2026-03-07T10:00:00Z",
            "severity": "ERROR",
            "message": "IAP auth failed",
            "resource": {"type": "gce_backend_service", "labels": {}},
            "trace": "",
            "labels": {"principal_email": "attacker@test.com"},
            "raw": {},
        }
        result = parse_iap_log(entry, "test-project")
        assert result["category"] == "iap_auth_failure"
        assert result["severity"] == "high"
