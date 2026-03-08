from unittest.mock import Mock, patch

import pytest

from monitor.services.gcp_aggregator import (
    gcp_discover_services,
    gcp_fetch_metrics,
    get_collection_errors,
)
from monitor.services.gcp_discovery import discover_services
from monitor.services.gcp_errors import GcpCollectionError
from monitor.services.gcp_log_fetcher import fetch_cloud_run_logs
from monitor.services.gcp_metrics_fetcher import fetch_service_metrics, fetch_timeseries


def test_discover_services_raises_actionable_error_on_permission_denied():
    credentials = Mock(token="test-token")
    response = Mock(status_code=403)
    response.json.return_value = {
        "error": {
            "message": "Permission 'run.services.list' denied on resource",
        }
    }
    response.text = '{"error":{"message":"Permission denied"}}'

    with (
        patch("monitor.services.gcp_discovery._get_credentials", return_value=credentials),
        patch("requests.get", return_value=response),
    ):
        with pytest.raises(GcpCollectionError, match="roles/run.viewer"):
            discover_services(
                service_account_key_json='{"client_email":"svc@example.com"}',
                project_id="test-project",
            )


def test_fetch_cloud_run_logs_raises_actionable_error_on_query_failure():
    client = Mock()
    client.list_entries.side_effect = RuntimeError("Permission denied")

    with patch("monitor.services.gcp_log_fetcher._get_client", return_value=client):
        with pytest.raises(GcpCollectionError, match="roles/logging.viewer"):
            fetch_cloud_run_logs(
                service_account_key_json='{"client_email":"svc@example.com"}',
                project_id="test-project",
            )


def test_fetch_service_metrics_raises_when_all_metrics_fail():
    client = Mock()
    client.list_time_series.side_effect = RuntimeError("Permission denied")

    with patch("monitor.services.gcp_metrics_fetcher._get_client", return_value=client):
        with pytest.raises(GcpCollectionError, match="roles/monitoring.viewer"):
            fetch_service_metrics(
                service_account_key_json='{"client_email":"svc@example.com"}',
                project_id="test-project",
            )


def test_fetch_timeseries_raises_actionable_error_on_failure():
    client = Mock()
    client.list_time_series.side_effect = RuntimeError("Permission denied")

    with patch("monitor.services.gcp_metrics_fetcher._get_client", return_value=client):
        with pytest.raises(GcpCollectionError, match="roles/monitoring.viewer"):
            fetch_timeseries(
                service_account_key_json='{"client_email":"svc@example.com"}',
                project_id="test-project",
            )


@pytest.mark.django_db
def test_gcp_discover_services_records_collection_error(
    user_factory,
    user_settings_factory,
):
    user = user_factory()
    user_settings_factory(
        user,
        gcp_project_id="test-project",
        gcp_service_account_key='{"type":"service_account"}',
    )

    with patch(
        "monitor.services.gcp_discovery.discover_services",
        side_effect=GcpCollectionError(
            "Cloud Run service discovery failed (403): Permission denied. "
            "Enable the Cloud Run Admin API and grant the service account roles/run.viewer."
        ),
    ):
        gcp_discover_services(user.id)

    assert "roles/run.viewer" in get_collection_errors(user.id)["discovery"]


@pytest.mark.django_db
def test_gcp_fetch_metrics_records_collection_error(
    user_factory,
    user_settings_factory,
):
    user = user_factory()
    user_settings_factory(
        user,
        gcp_project_id="test-project",
        gcp_service_account_key='{"type":"service_account"}',
    )

    with patch(
        "monitor.services.gcp_metrics_fetcher.fetch_service_metrics",
        side_effect=GcpCollectionError(
            "Cloud Monitoring metrics collection failed: Permission denied. "
            "Enable the Cloud Monitoring API and grant the service account roles/monitoring.viewer."
        ),
    ):
        gcp_fetch_metrics(user.id)

    assert "roles/monitoring.viewer" in get_collection_errors(user.id)["metrics"]
