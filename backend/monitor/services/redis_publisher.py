import json
import redis
from django.conf import settings

_client = None


def _get_redis():
    global _client
    if _client is None:
        _client = redis.from_url(settings.REDIS_URL)
    return _client


def publish_request(request_data: dict):
    _get_redis().publish("cyberlens:new_request", json.dumps(request_data))


def publish_alert(alert_data: dict):
    _get_redis().publish("cyberlens:alert", json.dumps(alert_data))


def publish_stats(stats_data: dict):
    _get_redis().publish("cyberlens:stats_update", json.dumps(stats_data))


def publish_scan_progress(progress_data: dict):
    _get_redis().publish("cyberlens:scan_progress", json.dumps(progress_data))


def publish_scan_complete(scan_data: dict):
    _get_redis().publish("cyberlens:scan_complete", json.dumps(scan_data))


def publish_code_scan_stream(stream_data: dict):
    _get_redis().publish("cyberlens:code_scan_stream", json.dumps(stream_data))
