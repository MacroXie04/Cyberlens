from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def mock_redis():
    redis_mock = MagicMock()
    with patch("monitor.services.redis_publisher._get_redis", return_value=redis_mock):
        yield redis_mock


@pytest.fixture(autouse=True)
def _use_locmem_cache(settings):
    settings.CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }
