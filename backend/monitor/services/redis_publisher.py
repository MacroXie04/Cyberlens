import json
import logging

import redis
from django.conf import settings

logger = logging.getLogger(__name__)

_client = None


def _get_redis():
    global _client
    if _client is None:
        _client = redis.from_url(settings.REDIS_URL)
    return _client


def _publish(channel: str, payload: dict):
    try:
        _get_redis().publish(channel, json.dumps(payload))
    except redis.RedisError as exc:
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
