import json
import logging

logger = logging.getLogger(__name__)

_client = None
_checked = False


def _get_redis():
    global _client, _checked
    if _checked:
        return _client
    _checked = True
    try:
        from django.conf import settings
        redis_url = getattr(settings, "REDIS_URL", "")
        if not redis_url:
            return None
        import redis
        _client = redis.from_url(redis_url)
        _client.ping()
    except Exception:
        _client = None
    return _client


def _publish(channel: str, payload: dict):
    client = _get_redis()
    if client is None:
        return
    try:
        client.publish(channel, json.dumps(payload))
    except Exception as exc:
        logger.warning("Redis publish skipped for %s: %s", channel, exc)


def publish_request(request_data: dict):
    _publish("cyberlens:new_request", request_data)


def publish_alert(alert_data: dict):
    _publish("cyberlens:alert", alert_data)


def publish_stats(stats_data: dict):
    _publish("cyberlens:stats_update", stats_data)


def publish_scan_progress(progress_data: dict):
    _publish("cyberlens:scan_progress", progress_data)


def publish_scan_complete(scan_data: dict):
    _publish("cyberlens:scan_complete", scan_data)


def publish_code_scan_stream(stream_data: dict):
    _publish("cyberlens:code_scan_stream", stream_data)


def publish_adk_trace_stream(trace_data: dict):
    _publish("cyberlens:adk_trace_stream", trace_data)


# GCP Estate & Security channels
def publish_gcp_estate_snapshot(snapshot_data: dict):
    _publish("cyberlens:gcp_estate_snapshot", snapshot_data)


def publish_gcp_security_event(event_data: dict):
    _publish("cyberlens:gcp_security_event", event_data)


def publish_gcp_incident_update(incident_data: dict):
    _publish("cyberlens:gcp_incident_update", incident_data)


def publish_gcp_service_health(health_data: dict):
    _publish("cyberlens:gcp_service_health", health_data)


def publish_gcp_timeseries_update(timeseries_data):
    _publish("cyberlens:gcp_timeseries_update", timeseries_data)
