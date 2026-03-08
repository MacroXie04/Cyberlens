import pytest
from pathlib import Path
from django.test import override_settings


@pytest.fixture
def scan_root(tmp_path):
    with override_settings(LOCAL_SCAN_ROOT=str(tmp_path)):
        yield tmp_path
