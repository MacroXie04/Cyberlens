from datetime import datetime


def serialize_event(event) -> dict:
    return {
        "id": event.id,
        "source": event.source,
        "timestamp": event.timestamp.isoformat() if isinstance(event.timestamp, datetime) else event.timestamp,
        "project_id": event.project_id,
        "region": event.region,
        "service": event.service,
        "revision": event.revision,
        "severity": event.severity,
        "category": event.category,
        "source_ip": event.source_ip,
        "principal": event.principal,
        "path": event.path,
        "method": event.method,
        "status_code": event.status_code,
        "trace_id": event.trace_id,
        "request_id": event.request_id,
        "country": event.country,
        "geo_lat": event.geo_lat,
        "geo_lng": event.geo_lng,
        "evidence_refs": event.evidence_refs,
        "raw_payload_preview": event.raw_payload_preview,
        "fact_fields": event.fact_fields,
        "inference_fields": event.inference_fields,
        "incident_id": event.incident_id,
    }


def serialize_incident(incident) -> dict:
    return {
        "id": incident.id,
        "project_id": incident.project_id,
        "incident_type": incident.incident_type,
        "priority": incident.priority,
        "status": incident.status,
        "confidence": incident.confidence,
        "evidence_count": incident.evidence_count,
        "services_affected": incident.services_affected,
        "regions_affected": incident.regions_affected,
        "title": incident.title,
        "narrative": incident.narrative,
        "likely_cause": incident.likely_cause,
        "next_steps": incident.next_steps,
        "ai_inference": incident.ai_inference,
        "first_seen": incident.first_seen.isoformat() if isinstance(incident.first_seen, datetime) else incident.first_seen,
        "last_seen": incident.last_seen.isoformat() if isinstance(incident.last_seen, datetime) else incident.last_seen,
        "acknowledged_by": incident.acknowledged_by,
        "acknowledged_at": incident.acknowledged_at.isoformat() if incident.acknowledged_at else None,
        "created_at": incident.created_at.isoformat() if isinstance(incident.created_at, datetime) else incident.created_at,
        "updated_at": incident.updated_at.isoformat() if isinstance(incident.updated_at, datetime) else incident.updated_at,
    }


def serialize_health(health) -> dict:
    return {"id": health.id, "project_id": health.project_id, "service_name": health.service_name, "region": health.region, "request_count": health.request_count, "error_count": health.error_count, "latency_p50_ms": health.latency_p50_ms, "latency_p95_ms": health.latency_p95_ms, "latency_p99_ms": health.latency_p99_ms, "instance_count": health.instance_count, "max_concurrency": health.max_concurrency, "cpu_utilization": health.cpu_utilization, "memory_utilization": health.memory_utilization, "bucket_start": health.bucket_start.isoformat(), "bucket_end": health.bucket_end.isoformat()}
