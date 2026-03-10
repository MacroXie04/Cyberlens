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


def publish_scan_progress(progress_data: dict):
    _publish("cyberlens:scan_progress", progress_data)


def publish_scan_complete(scan_data: dict):
    _publish("cyberlens:scan_complete", scan_data)


def publish_code_scan_stream(stream_data: dict):
    _publish("cyberlens:code_scan_stream", stream_data)


def publish_adk_trace_stream(trace_data: dict):
    _publish("cyberlens:adk_trace_stream", trace_data)
