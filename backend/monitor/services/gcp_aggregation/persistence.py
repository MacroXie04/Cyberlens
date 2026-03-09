from datetime import datetime, timedelta, timezone

from monitor.models import GcpSecurityEvent, GcpSecurityIncident, GcpServiceHealth
from monitor.services.redis_publisher import publish_gcp_incident_update, publish_gcp_security_event, publish_gcp_service_health

from .collection import event_fingerprint, parse_dt
from .serialization import serialize_event, serialize_health, serialize_incident

HISTORY_RETENTION_DAYS = 35


def cleanup_old_data(user, project_id: str, retention_days: int = HISTORY_RETENTION_DAYS) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    GcpServiceHealth.objects.filter(user=user, project_id=project_id, bucket_end__lt=cutoff).delete()
    GcpSecurityEvent.objects.filter(user=user, project_id=project_id, timestamp__lt=cutoff).delete()


def upsert_health_samples(*, user, project_id: str, samples: list[dict], publish: bool) -> list[GcpServiceHealth]:
    rows = [
        GcpServiceHealth(user=user, project_id=project_id, service_name=sample.get("service_name", "unknown"), region=sample.get("region", ""), request_count=int(round(sample.get("requests", 0) or 0)), error_count=int(round(sample.get("errors", 0) or 0)), latency_p50_ms=float(sample.get("latency_p50_ms", 0) or 0), latency_p95_ms=float(sample.get("latency_p95_ms", 0) or 0), latency_p99_ms=float(sample.get("latency_p99_ms", 0) or 0), instance_count=int(round(sample.get("instances", 0) or 0)), max_concurrency=float(sample.get("max_concurrency", 0) or 0), cpu_utilization=float(sample.get("cpu_utilization", 0) or 0), memory_utilization=float(sample.get("memory_utilization", 0) or 0), unhealthy_revision_count=int(round(sample.get("unhealthy_revision_count", 0) or 0)), bucket_start=(bucket_end := parse_dt(sample.get("bucket_end"))) - timedelta(minutes=5), bucket_end=bucket_end)
        for sample in samples
        if parse_dt(sample.get("bucket_end")) is not None
    ]
    if not rows:
        return []
    GcpServiceHealth.objects.bulk_create(rows, update_conflicts=True, update_fields=["request_count", "error_count", "latency_p50_ms", "latency_p95_ms", "latency_p99_ms", "instance_count", "max_concurrency", "cpu_utilization", "memory_utilization", "unhealthy_revision_count", "bucket_start"], unique_fields=["user", "project_id", "service_name", "region", "bucket_end"])
    created = list(GcpServiceHealth.objects.filter(user=user, project_id=project_id, bucket_end__in=[row.bucket_end for row in rows], service_name__in=[row.service_name for row in rows]))
    if publish:
        for health in created:
            publish_gcp_service_health(serialize_health(health))
    return created


def persist_events(*, user, project_id: str, event_dicts: list[dict], publish: bool, run_rule_engine: bool) -> list[GcpSecurityEvent]:
    unique_events, fingerprints, seen = [], [], set()
    for event in event_dicts:
        event["project_id"] = event.get("project_id") or project_id
        fingerprint = event_fingerprint(event)
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        event["fingerprint"] = fingerprint
        unique_events.append(event)
        fingerprints.append(fingerprint)
    existing = set(GcpSecurityEvent.objects.filter(user=user, project_id=project_id, fingerprint__in=fingerprints).values_list("fingerprint", flat=True))
    db_events = [GcpSecurityEvent(user=user, source=event["source"], timestamp=parse_dt(event["timestamp"]), project_id=event["project_id"], region=event.get("region", ""), service=event.get("service", ""), revision=event.get("revision", ""), severity=event.get("severity", "info"), category=event.get("category", "other"), source_ip=event.get("source_ip"), principal=event.get("principal", ""), path=event.get("path", ""), method=event.get("method", ""), status_code=event.get("status_code"), trace_id=event.get("trace_id", ""), request_id=event.get("request_id", ""), fingerprint=event["fingerprint"], country=event.get("country", ""), geo_lat=event.get("geo_lat"), geo_lng=event.get("geo_lng"), evidence_refs=event.get("evidence_refs", []), raw_payload_preview=event.get("raw_payload_preview", ""), fact_fields=event.get("fact_fields", {}), inference_fields=event.get("inference_fields", {})) for event in unique_events if event["fingerprint"] not in existing]
    created = GcpSecurityEvent.objects.bulk_create(db_events) if db_events else []
    if publish:
        for event in created:
            publish_gcp_security_event(serialize_event(event))
    if run_rule_engine and created:
        from monitor.services import gcp_rule_engine

        incident_dicts = gcp_rule_engine.evaluate_events(user, project_id, created)
        if incident_dicts:
            for incident in gcp_rule_engine.create_incidents(user, project_id, incident_dicts):
                publish_gcp_incident_update(serialize_incident(incident))
            for incident_dict in incident_dicts:
                if incident_dict["action"] == "updated" and incident_dict.get("incident_id"):
                    try:
                        incident = GcpSecurityIncident.objects.get(id=incident_dict["incident_id"])
                    except GcpSecurityIncident.DoesNotExist:
                        continue
                    publish_gcp_incident_update(serialize_incident(incident))
    return created
