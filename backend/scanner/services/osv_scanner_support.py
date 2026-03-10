import logging

import requests
from django.utils import timezone

from cyberlens.redis_publisher import publish_scan_complete
from scanner.models import GitHubScan

logger = logging.getLogger(__name__)
OSV_API = "https://api.osv.dev/v1/querybatch"


def classify_severity(cvss: float) -> str:
    if cvss >= 9.0:
        return "critical"
    if cvss >= 7.0:
        return "high"
    if cvss >= 4.0:
        return "medium"
    return "low" if cvss > 0 else ""


def query_osv(deps: list[dict]) -> list[dict]:
    queries = []
    for dep in deps:
        query = {"package": {"name": dep["name"], "ecosystem": dep["ecosystem"]}}
        if dep.get("version"):
            query["version"] = dep["version"]
        queries.append(query)
    try:
        response = requests.post(OSV_API, json={"queries": queries}, timeout=30)
        response.raise_for_status()
        return response.json().get("results", [])
    except requests.RequestException:
        logger.exception("OSV API query failed")
        return []


def mark_scan_failed(scan_id, error_msg: str):
    try:
        scan = GitHubScan.objects.get(id=scan_id)
        scan.scan_status = "failed"
        scan.error_message = error_msg
        scan.completed_at = timezone.now()
        scan.save(update_fields=["scan_status", "error_message", "completed_at"])
    except GitHubScan.DoesNotExist:
        pass
    publish_scan_complete({"scan_id": scan_id, "status": "failed", "message": error_msg})
