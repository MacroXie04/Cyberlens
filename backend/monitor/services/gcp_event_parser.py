"""Parse raw GCP log entries into normalised GcpSecurityEvent dicts."""

from datetime import datetime, timezone

from .gcp_event_parser_support import classify_message as _classify_message
from .gcp_event_parser_support import map_gcp_severity as _map_gcp_severity
from .gcp_event_parser_support import max_severity


def parse_cloud_run_log(entry: dict, project_id: str) -> dict | None:
    msg = entry.get("message", "")
    severity_raw = entry.get("severity", "DEFAULT")
    labels = entry.get("resource", {}).get("labels", {})
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
    if isinstance(http_req, dict):
        event["source_ip"] = http_req.get("remoteIp")
        event["path"] = http_req.get("requestUrl", "")
        event["method"] = http_req.get("requestMethod", "")
        event["status_code"] = http_req.get("status")
    event["category"] = _classify_message(msg, severity_raw, event.get("status_code"))
    if event["category"] in ("sql_injection", "xss", "path_traversal", "credential_abuse"):
        event["severity"] = max_severity(event["severity"], "high")
    elif event["category"] == "bot_probing":
        event["severity"] = max_severity(event["severity"], "medium")
    elif event["category"] == "error_surge" and severity_raw in ("ERROR", "CRITICAL", "ALERT", "EMERGENCY"):
        event["severity"] = max_severity(event["severity"], "high")
    return event


def parse_load_balancer_log(entry: dict, project_id: str) -> dict | None:
    raw = entry.get("raw", {})
    http_req = raw.get("httpRequest", {})
    event = {
        "source": "load_balancer",
        "timestamp": entry.get("timestamp") or datetime.now(timezone.utc).isoformat(),
        "project_id": project_id,
        "region": entry.get("resource", {}).get("labels", {}).get("zone", ""),
        "service": raw.get("resource", {}).get("labels", {}).get("backend_service_name", ""),
        "severity": _map_gcp_severity(entry.get("severity", "DEFAULT")),
        "category": _classify_message(http_req.get("requestUrl", "") + " " + entry.get("message", ""), entry.get("severity", ""), http_req.get("status")),
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
    return event


def parse_cloud_armor_log(entry: dict, project_id: str) -> dict | None:
    raw = entry.get("raw", {})
    policy = raw.get("jsonPayload", {}).get("enforcedSecurityPolicy", {})
    http_req = raw.get("httpRequest", {})
    return {
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


def parse_iam_audit_log(entry: dict, project_id: str) -> dict | None:
    proto_payload = entry.get("raw", {}).get("protoPayload", {})
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
    method = proto_payload.get("methodName", "").lower()
    if any(token in method for token in ("setiam", "create", "delete", "update", "bind")):
        event["severity"] = "high"
    elif any(token in method for token in ("getiam", "list", "get")):
        event["severity"] = "info"
        event["category"] = "other"
    return event


def parse_iap_log(entry: dict, project_id: str) -> dict | None:
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
