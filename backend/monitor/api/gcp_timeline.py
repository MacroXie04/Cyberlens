from datetime import datetime, timedelta, timezone

from monitor.models import GcpSecurityEvent, GcpSecurityIncident, GcpServiceHealth

from .gcp_helpers import apply_service_filters, history_metadata, parse_dt_param


def bucket_seconds(bucket: str) -> int:
    return {"5m": 300, "1h": 3600, "6h": 21600}.get(bucket, 21600)


def floor_bucket(dt_value, seconds: int):
    epoch = int(dt_value.timestamp())
    return datetime.fromtimestamp(epoch - (epoch % seconds), tz=timezone.utc)


def timeline_markers(user, project_id, start, end):
    markers = [
        {
            "id": f"incident-{incident.id}",
            "kind": "incident",
            "ts": incident.last_seen.isoformat(),
            "severity": incident.priority,
            "title": incident.title,
        }
        for incident in GcpSecurityIncident.objects.filter(
            user=user,
            project_id=project_id,
            first_seen__lte=end,
            last_seen__gte=start,
        )[:100]
    ]
    markers.extend(
        {
            "id": f"event-{event.id}",
            "kind": "event",
            "ts": event.timestamp.isoformat(),
            "severity": event.severity,
            "title": event.category.replace("_", " "),
        }
        for event in GcpSecurityEvent.objects.filter(
            user=user,
            project_id=project_id,
            timestamp__gte=start,
            timestamp__lte=end,
            severity__in=["high", "critical"],
        ).order_by("-timestamp")[:120]
    )
    return sorted(markers, key=lambda marker: marker["ts"])


def timeline_payload(user, project_id, start, end, bucket: str, request):
    step = bucket_seconds(bucket)
    rows = apply_service_filters(
        GcpServiceHealth.objects.filter(
            user=user,
            project_id=project_id,
            bucket_end__gte=start,
            bucket_end__lte=end,
        ),
        request,
    )
    points = {}
    cursor = floor_bucket(start, step)
    while cursor <= end:
        key = cursor.isoformat()
        points[key] = {"ts": key, "requests": 0, "errors": 0, "incident_count": 0}
        cursor += timedelta(seconds=step)

    for row in rows:
        key = floor_bucket(row.bucket_end, step).isoformat()
        point = points.setdefault(key, {"ts": key, "requests": 0, "errors": 0, "incident_count": 0})
        point["requests"] += row.request_count
        point["errors"] += row.error_count

    markers = timeline_markers(user, project_id, start, end)
    for marker in markers:
        marker_dt = parse_dt_param("marker", marker["ts"])
        if marker_dt is None or marker["kind"] != "incident":
            continue
        key = floor_bucket(marker_dt, step).isoformat()
        if key in points:
            points[key]["incident_count"] += 1

    payload = {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "bucket": bucket,
        "points": [points[key] for key in sorted(points)],
        "markers": markers,
    }
    payload.update(history_metadata(user, project_id))
    return payload
