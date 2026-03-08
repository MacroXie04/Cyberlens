"""Auto-discover Cloud Run services and revisions within a GCP project."""

import json
import logging

from google.auth.transport.requests import Request
from google.oauth2 import service_account

logger = logging.getLogger(__name__)

CLOUD_RUN_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]


def _get_credentials(service_account_key_json: str):
    key_info = json.loads(service_account_key_json)
    return service_account.Credentials.from_service_account_info(
        key_info, scopes=CLOUD_RUN_SCOPES
    )


def discover_services(
    *,
    service_account_key_json: str,
    project_id: str,
    regions: list[str] | None = None,
    service_filters: list[str] | None = None,
) -> list[dict]:
    """Discover all Cloud Run services in a project.

    Returns a list of dicts with keys:
      service_name, region, latest_revision, url, last_deployed_at
    """
    import requests as http

    credentials = _get_credentials(service_account_key_json)
    credentials.refresh(Request())

    headers = {"Authorization": f"Bearer {credentials.token}"}

    # Cloud Run Admin API v2: list services across all regions
    parent = f"projects/{project_id}/locations/-"
    url = f"https://run.googleapis.com/v2/{parent}/services"

    results = []
    page_token = None

    while True:
        params = {"pageSize": 100}
        if page_token:
            params["pageToken"] = page_token

        resp = http.get(url, headers=headers, params=params, timeout=30)
        if resp.status_code != 200:
            logger.error("Cloud Run API error %s: %s", resp.status_code, resp.text[:500])
            break

        data = resp.json()

        for svc in data.get("services", []):
            # name format: projects/PROJECT/locations/REGION/services/SERVICE
            name_parts = svc.get("name", "").split("/")
            svc_region = name_parts[3] if len(name_parts) > 3 else ""
            svc_name = name_parts[5] if len(name_parts) > 5 else svc.get("name", "")

            if regions and svc_region not in regions:
                continue
            if service_filters and svc_name not in service_filters:
                continue

            latest_revision = ""
            if svc.get("latestReadyRevision"):
                rev_parts = svc["latestReadyRevision"].split("/")
                latest_revision = rev_parts[-1] if rev_parts else svc["latestReadyRevision"]

            results.append({
                "service_name": svc_name,
                "region": svc_region,
                "latest_revision": latest_revision,
                "url": svc.get("uri", ""),
                "last_deployed_at": svc.get("updateTime"),
            })

        page_token = data.get("nextPageToken")
        if not page_token:
            break

    return results
