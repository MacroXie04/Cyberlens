"""Rule engine for generating GcpSecurityIncident from GcpSecurityEvent streams."""

from collections import defaultdict
from datetime import datetime, timezone

from .gcp_rule_engine_defs import _CATEGORY_TO_INCIDENT, _INCIDENT_PRIORITY, _INCIDENT_TITLES, _MERGE_WINDOW, THRESHOLDS


def evaluate_events(user, project_id: str, events: list) -> list[dict]:
    from monitor.models import GcpSecurityIncident

    by_category = defaultdict(list)
    for event in events:
        category = event.category if hasattr(event, "category") else event.get("category", "other")
        if category != "other":
            by_category[category].append(event)

    incidents = []
    for category, category_events in by_category.items():
        incident_type = _CATEGORY_TO_INCIDENT.get(category)
        threshold = THRESHOLDS.get(incident_type.replace("attack_", ""), 1) if incident_type else None
        if not incident_type or len(category_events) < threshold:
            continue

        services, regions, event_ids, timestamps = set(), set(), [], []
        for event in category_events:
            if hasattr(event, "id"):
                event_ids.append(event.id)
                services.add(event.service)
                regions.add(event.region)
                timestamp = event.timestamp
            else:
                services.add(event.get("service", ""))
                regions.add(event.get("region", ""))
                timestamp = event.get("timestamp")

            if isinstance(timestamp, str):
                try:
                    timestamps.append(datetime.fromisoformat(timestamp))
                except (ValueError, TypeError):
                    timestamps.append(datetime.now(timezone.utc))
            elif isinstance(timestamp, datetime):
                timestamps.append(timestamp)

        if not timestamps:
            continue

        first_seen, last_seen = min(timestamps), max(timestamps)
        existing = GcpSecurityIncident.objects.filter(
            user=user,
            project_id=project_id,
            incident_type=incident_type,
            status__in=["open", "investigating"],
            last_seen__gte=last_seen - _MERGE_WINDOW,
        ).first()

        if existing:
            existing.evidence_count += len(category_events)
            existing.last_seen = max(existing.last_seen, last_seen)
            existing.services_affected = sorted(service for service in (set(existing.services_affected or []) | services) if service)
            existing.regions_affected = sorted(region for region in (set(existing.regions_affected or []) | regions) if region)
            existing.save(update_fields=["evidence_count", "last_seen", "services_affected", "regions_affected", "updated_at"])
            incidents.append({"action": "updated", "incident_id": existing.id, "incident_type": incident_type, "event_ids": event_ids})
            continue

        incidents.append(
            {
                "action": "create",
                "incident_type": incident_type,
                "priority": _INCIDENT_PRIORITY.get(incident_type, "p3"),
                "confidence": min(0.95, 0.5 + (len(category_events) * 0.05)),
                "evidence_count": len(category_events),
                "services_affected": sorted(service for service in services if service),
                "regions_affected": sorted(region for region in regions if region),
                "title": _INCIDENT_TITLES.get(incident_type, incident_type),
                "first_seen": first_seen,
                "last_seen": last_seen,
                "event_ids": event_ids,
            }
        )
    return incidents


def create_incidents(user, project_id: str, incident_dicts: list[dict]):
    from monitor.models import GcpSecurityEvent, GcpSecurityIncident

    created = []
    for incident_data in incident_dicts:
        if incident_data["action"] == "create":
            incident = GcpSecurityIncident.objects.create(
                user=user,
                project_id=project_id,
                incident_type=incident_data["incident_type"],
                priority=incident_data["priority"],
                confidence=incident_data["confidence"],
                evidence_count=incident_data["evidence_count"],
                services_affected=incident_data["services_affected"],
                regions_affected=incident_data["regions_affected"],
                title=incident_data["title"],
                first_seen=incident_data["first_seen"],
                last_seen=incident_data["last_seen"],
            )
            if incident_data.get("event_ids"):
                GcpSecurityEvent.objects.filter(id__in=incident_data["event_ids"]).update(incident=incident)
            created.append(incident)
        elif incident_data["action"] == "updated" and incident_data.get("event_ids") and incident_data.get("incident_id"):
            GcpSecurityEvent.objects.filter(id__in=incident_data["event_ids"]).update(incident_id=incident_data["incident_id"])
    return created
