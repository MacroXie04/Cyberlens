import json
from unittest.mock import patch, MagicMock
from monitor.services.redis_publisher import (
    publish_request,
    publish_alert,
    publish_stats,
    publish_scan_progress,
    publish_scan_complete,
)


class TestPublishRequest:
    @patch("monitor.services.redis_publisher._get_redis")
    def test_publishes_to_correct_channel(self, mock_get_redis):
        mock_redis = MagicMock()
        mock_get_redis.return_value = mock_redis
        data = {"ip": "1.2.3.4", "path": "/test"}
        publish_request(data)
        mock_redis.publish.assert_called_once_with("cyberlens:new_request", json.dumps(data))


class TestPublishAlert:
    @patch("monitor.services.redis_publisher._get_redis")
    def test_publishes_to_correct_channel(self, mock_get_redis):
        mock_redis = MagicMock()
        mock_get_redis.return_value = mock_redis
        data = {"severity": "critical", "message": "Attack detected"}
        publish_alert(data)
        mock_redis.publish.assert_called_once_with("cyberlens:alert", json.dumps(data))


class TestPublishStats:
    @patch("monitor.services.redis_publisher._get_redis")
    def test_publishes_to_correct_channel(self, mock_get_redis):
        mock_redis = MagicMock()
        mock_get_redis.return_value = mock_redis
        data = {"total": 100}
        publish_stats(data)
        mock_redis.publish.assert_called_once_with("cyberlens:stats_update", json.dumps(data))


class TestPublishScanProgress:
    @patch("monitor.services.redis_publisher._get_redis")
    def test_publishes_to_correct_channel(self, mock_get_redis):
        mock_redis = MagicMock()
        mock_get_redis.return_value = mock_redis
        data = {"scan_id": 1, "step": "parsing"}
        publish_scan_progress(data)
        mock_redis.publish.assert_called_once_with("cyberlens:scan_progress", json.dumps(data))


class TestPublishScanComplete:
    @patch("monitor.services.redis_publisher._get_redis")
    def test_publishes_to_correct_channel(self, mock_get_redis):
        mock_redis = MagicMock()
        mock_get_redis.return_value = mock_redis
        data = {"scan_id": 1, "status": "completed"}
        publish_scan_complete(data)
        mock_redis.publish.assert_called_once_with("cyberlens:scan_complete", json.dumps(data))
