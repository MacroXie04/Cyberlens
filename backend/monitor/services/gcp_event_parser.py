"""Parse raw GCP log entries into normalised GcpSecurityEvent dicts."""

import logging
import re
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Pattern matchers for security signal detection
_SQLI_PATTERNS = re.compile(
    r"(union\s+select|or\s+1\s*=\s*1|'\s*or\s*'|;\s*drop\s|--\s*$|/\*.*\*/|xp_cmdshell|SLEEP\s*\()",
    re.IGNORECASE,
)
_XSS_PATTERNS = re.compile(
    r"(<script|javascript:|onerror\s*=|onload\s*=|<iframe|<svg\s+onload|alert\s*\()",
    re.IGNORECASE,
)
_PATH_TRAVERSAL_PATTERNS = re.compile(
    r"(\.\./|\.\.\\|/etc/passwd|/etc/shadow|/proc/self|%2e%2e)",
    re.IGNORECASE,
)
_BOT_PATTERNS = re.compile(
    r"(sqlmap|nikto|nmap|masscan|zgrab|gobuster|dirbuster|nuclei|wpscan|acunetix)",
    re.IGNORECASE,
)
_CREDENTIAL_PATTERNS = re.compile(
    r"(failed\s+login|invalid\s+credentials|auth.*fail|unauthorized|token\s+expired|permission\s+denied)",
    re.IGNORECASE,
)


def parse_cloud_run_log(entry: dict, project_id: str) -> dict | None:
    """Parse a Cloud Run log entry into a GcpSecurityEvent dict."""
    msg = entry.get("message", "")
    severity_raw = entry.get("severity", "DEFAULT")
    resource = entry.get("resource", {})
    labels = resource.get("labels", {})
    http_req = entry.get("http_request")

    event = {
        "source": "cloud_run_logs",
        "timestamp": entry.get("timestamp") or datetime.now(timezone.utc).isoformat(),
        "project_id": project_id,
        "region": labels.get("location", ""),
        "service": labels.get("service_name", ""),
        "revision": labels.get("revision_name", ""),
        "severity": _map_gcp_severity(severity_raw),
        "category": "other",
        "trace_id": entry.get("trace", ""),
        "raw_payload_preview": msg[:500],
        "fact_fields": {},
        "inference_fields": {},
    }

    # Extract HTTP info if available
    if http_req:
        if isinstance(http_req, dict):
            event["source_ip"] = http_req.get("remoteIp")
            event["path"] = http_req.get("requestUrl", "")
            event["method"] = http_req.get("requestMethod", "")
            event["status_code"] = http_req.get("status")

    # Detect security category from message content
    event["category"] = _classify_message(msg, severity_raw, event.get("status_code"))

    # Escalate severity based on detected category
    if event["category"] in ("sql_injection", "xss", "path_traversal", "credential_abuse"):
        event["severity"] = max_severity(event["severity"], "high")
    elif event["category"] in ("bot_probing",):
        event["severity"] = max_severity(event["severity"], "medium")
    elif event["category"] == "error_surge" and severity_raw in ("ERROR", "CRITICAL", "ALERT", "EMERGENCY"):
        event["severity"] = max_severity(event["severity"], "high")

    return event


def parse_load_balancer_log(entry: dict, project_id: str) -> dict | None:
    """Parse an HTTPS Load Balancer log entry."""
    raw = entry.get("raw", {})
    http_req = raw.get("httpRequest", {})

    event = {
        "source": "load_balancer",
        "timestamp": entry.get("timestamp") or datetime.now(timezone.utc).isoformat(),
        "project_id": project_id,
        "region": entry.get("resource", {}).get("labels", {}).get("zone", ""),
        "service": raw.get("resource", {}).get("labels", {}).get("backend_service_name", ""),
        "severity": _map_gcp_severity(entry.get("severity", "DEFAULT")),
        "category": "other",
        "source_ip": http_req.get("remoteIp"),
        "path": http_req.get("requestUrl", ""),
        "method": http_req.get("requestMethod", ""),
        "status_code": http_req.get("status"),
        "country": raw.get("jsonPayload", {}).get("remoteIpCountry", ""),
        "trace_id": entry.get("trace", ""),
        "raw_payload_preview": entry.get("message", "")[:500],
        "fact_fields": {},
        "inference_fields": {},
    }

    # Check for attack patterns in URL
    url = event["path"]
    msg = entry.get("message", "")
    event["category"] = _classify_message(url + " " + msg, entry.get("severity", ""), event.get("status_code"))

    return event


def parse_cloud_armor_log(entry: dict, project_id: str) -> dict | None:
    """Parse a Cloud Armor enforcement log entry."""
    raw = entry.get("raw", {})
    policy = raw.get("jsonPayload", {}).get("enforcedSecurityPolicy", {})
    http_req = raw.get("httpRequest", {})

    event = {
        "source": "cloud_armor",
        "timestamp": entry.get("timestamp") or datetime.now(timezone.utc).isoformat(),
        "project_id": project_id,
        "region": entry.get("resource", {}).get("labels", {}).get("zone", ""),
        "service": entry.get("resource", {}).get("labels", {}).get("backend_service_name", ""),
        "severity": "high",
        "category": "armor_block",
        "source_ip": http_req.get("remoteIp"),
        "path": http_req.get("requestUrl", ""),
        "method": http_req.get("requestMethod", ""),
        "status_code": http_req.get("status"),
        "trace_id": entry.get("trace", ""),
        "raw_payload_preview": entry.get("message", "")[:500],
        "fact_fields": {
            "policy_name": policy.get("name", ""),
            "rule_priority": policy.get("priority", ""),
            "outcome": policy.get("outcome", ""),
            "matched_expression": policy.get("configuredAction", ""),
        },
        "inference_fields": {},
    }

    return event


def parse_iam_audit_log(entry: dict, project_id: str) -> dict | None:
    """Parse an IAM / Admin Activity audit log."""
    raw = entry.get("raw", {})
    proto_payload = raw.get("protoPayload", {})

    event = {
        "source": "iam_audit",
        "timestamp": entry.get("timestamp") or datetime.now(timezone.utc).isoformat(),
        "project_id": project_id,
        "severity": _map_gcp_severity(entry.get("severity", "DEFAULT")),
        "category": "iam_drift",
        "principal": proto_payload.get("authenticationInfo", {}).get("principalEmail", ""),
        "path": proto_payload.get("resourceName", ""),
        "method": proto_payload.get("methodName", ""),
        "trace_id": entry.get("trace", ""),
        "raw_payload_preview": entry.get("message", "")[:500],
        "fact_fields": {
            "method_name": proto_payload.get("methodName", ""),
            "resource_name": proto_payload.get("resourceName", ""),
            "service_name": proto_payload.get("serviceName", ""),
        },
        "inference_fields": {},
    }

    # Detect permission changes vs reads
    method = proto_payload.get("methodName", "").lower()
    if any(kw in method for kw in ("setiam", "create", "delete", "update", "bind")):
        event["severity"] = "high"
    elif any(kw in method for kw in ("getiam", "list", "get")):
        event["severity"] = "info"
        event["category"] = "other"

    return event


def parse_iap_log(entry: dict, project_id: str) -> dict | None:
    """Parse an Identity-Aware Proxy log."""
    raw = entry.get("raw", {})

    event = {
        "source": "iap",
        "timestamp": entry.get("timestamp") or datetime.now(timezone.utc).isoformat(),
        "project_id": project_id,
        "severity": _map_gcp_severity(entry.get("severity", "DEFAULT")),
        "category": "iap_auth_failure",
        "principal": entry.get("labels", {}).get("principal_email", ""),
        "source_ip": raw.get("httpRequest", {}).get("remoteIp") if isinstance(raw, dict) else None,
        "trace_id": entry.get("trace", ""),
        "raw_payload_preview": entry.get("message", "")[:500],
        "fact_fields": {},
        "inference_fields": {},
    }

    sev = entry.get("severity", "").upper()
    if sev in ("ERROR", "CRITICAL", "ALERT", "EMERGENCY"):
        event["severity"] = "high"
    else:
        event["severity"] = "medium"
        event["category"] = "other"

    return event


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_GCP_SEVERITY_MAP = {
    "DEFAULT": "info",
    "DEBUG": "info",
    "INFO": "info",
    "NOTICE": "low",
    "WARNING": "medium",
    "ERROR": "high",
    "CRITICAL": "critical",
    "ALERT": "critical",
    "EMERGENCY": "critical",
}


def _map_gcp_severity(gcp_severity: str) -> str:
    return _GCP_SEVERITY_MAP.get(gcp_severity.upper(), "info")


_SEVERITY_ORDER = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}


def max_severity(a: str, b: str) -> str:
    return a if _SEVERITY_ORDER.get(a, 0) >= _SEVERITY_ORDER.get(b, 0) else b


def _classify_message(text: str, severity: str, status_code: int | None) -> str:
    """Classify a log message into a security category."""
    if _SQLI_PATTERNS.search(text):
        return "sql_injection"
    if _XSS_PATTERNS.search(text):
        return "xss"
    if _PATH_TRAVERSAL_PATTERNS.search(text):
        return "path_traversal"
    if _BOT_PATTERNS.search(text):
        return "bot_probing"
    if _CREDENTIAL_PATTERNS.search(text):
        return "credential_abuse"
    if status_code and status_code == 429:
        return "rate_limit"
    if status_code and status_code >= 500:
        sev = severity.upper() if isinstance(severity, str) else ""
        if sev in ("ERROR", "CRITICAL", "ALERT", "EMERGENCY"):
            return "error_surge"
    return "other"
