import re

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

_SEVERITY_ORDER = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}


def map_gcp_severity(gcp_severity: str) -> str:
    return _GCP_SEVERITY_MAP.get(gcp_severity.upper(), "info")


def max_severity(a: str, b: str) -> str:
    return a if _SEVERITY_ORDER.get(a, 0) >= _SEVERITY_ORDER.get(b, 0) else b


def classify_message(text: str, severity: str, status_code: int | None) -> str:
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
