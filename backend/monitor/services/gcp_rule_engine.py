"""Rule engine for generating GcpSecurityIncident from GcpSecurityEvent streams."""

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from django.db.models import Count, Q

logger = logging.getLogger(__name__)

# Incident clustering windows
_CLUSTER_WINDOW = timedelta(minutes=10)
_MERGE_WINDOW = timedelta(minutes=5)

# Thresholds for incident generation
THRESHOLDS = {
    "armor_block_spike": 5,       # blocks in window to trigger
    "auth_failure_burst": 10,     # auth failures in window
    "error_surge": 10,            # 5xx errors in window
    "sqli_xss_traversal": 2,      # attack attempts in window
    "bot_probing": 5,             # bot probes in window
    "iam_drift": 1,               # any IAM change is notable
    "latency_surge": 1,           # detected by metrics, not log count
    "revision_regression": 1,     # detected by metrics
    "cold_start_surge": 1,        # detected by metrics
}

# Category → Incident type mapping
_CATEGORY_TO_INCIDENT = {
    "sql_injection": "attack_sqli_xss_traversal",
    "xss": "attack_sqli_xss_traversal",
    "path_traversal": "attack_sqli_xss_traversal",
    "bot_probing": "bot_probing_campaign",
    "credential_abuse": "credential_abuse_burst",
    "armor_block": "armor_block_spike",
    "iap_auth_failure": "auth_failure_burst",
    "iam_drift": "iam_permission_drift",
    "error_surge": "error_surge",
    "latency_surge": "latency_surge",
    "revision_regression": "revision_regression",
    "cold_start_surge": "cold_start_surge",
    "rate_limit": "rate_limit_spike",
}

# Incident type → priority mapping
_INCIDENT_PRIORITY = {
    "attack_sqli_xss_traversal": "p1",
    "credential_abuse_burst": "p1",
    "armor_block_spike": "p2",
    "auth_failure_burst": "p2",
    "iam_permission_drift": "p2",
    "error_surge": "p2",
    "bot_probing_campaign": "p3",
    "latency_surge": "p3",
    "revision_regression": "p3",
    "cold_start_surge": "p4",
    "rate_limit_spike": "p3",
}

# Human-readable incident titles
_INCIDENT_TITLES = {
    "attack_sqli_xss_traversal": "Web Attack Detected (SQLi/XSS/Traversal)",
    "credential_abuse_burst": "Credential Abuse Burst",
    "armor_block_spike": "Cloud Armor Block Spike",
    "auth_failure_burst": "Authentication Failure Burst",
    "iam_permission_drift": "IAM Permission Change Detected",
    "error_surge": "5xx Error Surge",
    "bot_probing_campaign": "Bot/Scanner Probing Campaign",
    "latency_surge": "Latency Surge Detected",
    "revision_regression": "Revision Regression Detected",
    "cold_start_surge": "Cold Start Surge",
    "rate_limit_spike": "Rate Limiting Spike",
}


def evaluate_events(user, project_id: str, events: list) -> list[dict]:
    """Evaluate a batch of events against rules, return incident dicts to create/update.

    Each returned dict has: incident_type, priority, confidence, evidence_count,
    services_affected, regions_affected, title, first_seen, last_seen, event_ids.
    """
    from monitor.models import GcpSecurityIncident

    # Group events by category
    by_category: dict[str, list] = defaultdict(list)
    for event in events:
        cat = event.category if hasattr(event, "category") else event.get("category", "other")
        if cat != "other":
            by_category[cat].append(event)

    incidents_to_create = []

    for category, cat_events in by_category.items():
        incident_type = _CATEGORY_TO_INCIDENT.get(category)
        if not incident_type:
            continue

        threshold = THRESHOLDS.get(incident_type.replace("attack_", ""), 1)
        if len(cat_events) < threshold:
            continue

        # Collect metadata
        services = set()
        regions = set()
        event_ids = []
        timestamps = []

        for evt in cat_events:
            if hasattr(evt, "id"):
                event_ids.append(evt.id)
                services.add(evt.service)
                regions.add(evt.region)
                ts = evt.timestamp
            else:
                services.add(evt.get("service", ""))
                regions.add(evt.get("region", ""))
                ts = evt.get("timestamp")

            if isinstance(ts, str):
                try:
                    timestamps.append(datetime.fromisoformat(ts))
                except (ValueError, TypeError):
                    timestamps.append(datetime.now(timezone.utc))
            elif isinstance(ts, datetime):
                timestamps.append(ts)

        if not timestamps:
            continue

        first_seen = min(timestamps)
        last_seen = max(timestamps)

        # Check for existing open incident to merge into
        merge_cutoff = last_seen - _MERGE_WINDOW
        existing = GcpSecurityIncident.objects.filter(
            user=user,
            project_id=project_id,
            incident_type=incident_type,
            status__in=["open", "investigating"],
            last_seen__gte=merge_cutoff,
        ).first()

        if existing:
            # Update existing incident
            existing.evidence_count += len(cat_events)
            existing.last_seen = max(existing.last_seen, last_seen)
            svc_set = set(existing.services_affected or []) | services
            reg_set = set(existing.regions_affected or []) | regions
            existing.services_affected = sorted(s for s in svc_set if s)
            existing.regions_affected = sorted(r for r in reg_set if r)
            existing.save(update_fields=[
                "evidence_count", "last_seen", "services_affected", "regions_affected", "updated_at"
            ])
            incidents_to_create.append({
                "action": "updated",
                "incident_id": existing.id,
                "incident_type": incident_type,
                "event_ids": event_ids,
            })
        else:
            # Compute confidence from evidence count
            confidence = min(0.95, 0.5 + (len(cat_events) * 0.05))

            incidents_to_create.append({
                "action": "create",
                "incident_type": incident_type,
                "priority": _INCIDENT_PRIORITY.get(incident_type, "p3"),
                "confidence": confidence,
                "evidence_count": len(cat_events),
                "services_affected": sorted(s for s in services if s),
                "regions_affected": sorted(r for r in regions if r),
                "title": _INCIDENT_TITLES.get(incident_type, incident_type),
                "first_seen": first_seen,
                "last_seen": last_seen,
                "event_ids": event_ids,
            })

    return incidents_to_create


def create_incidents(user, project_id: str, incident_dicts: list[dict]):
    """Persist incident dicts to database, link events."""
    from monitor.models import GcpSecurityIncident, GcpSecurityEvent

    created = []

    for inc in incident_dicts:
        if inc["action"] == "create":
            incident = GcpSecurityIncident.objects.create(
                user=user,
                project_id=project_id,
                incident_type=inc["incident_type"],
                priority=inc["priority"],
                confidence=inc["confidence"],
                evidence_count=inc["evidence_count"],
                services_affected=inc["services_affected"],
                regions_affected=inc["regions_affected"],
                title=inc["title"],
                first_seen=inc["first_seen"],
                last_seen=inc["last_seen"],
            )
            # Link events to incident
            if inc.get("event_ids"):
                GcpSecurityEvent.objects.filter(
                    id__in=inc["event_ids"]
                ).update(incident=incident)
            created.append(incident)

        elif inc["action"] == "updated":
            # Events already linked via evaluate_events for updates,
            # but link new events to existing incident
            if inc.get("event_ids") and inc.get("incident_id"):
                GcpSecurityEvent.objects.filter(
                    id__in=inc["event_ids"]
                ).update(incident_id=inc["incident_id"])

    return created
