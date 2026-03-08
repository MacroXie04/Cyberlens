from datetime import datetime, timezone
from unittest.mock import Mock, patch

from monitor.services.cloud_logging import fetch_cloud_run_logs


class FakeLogEntry:
    def __init__(self, *, payload, severity="INFO"):
        self.payload = payload
        self.severity = severity
        self.timestamp = datetime(2026, 3, 7, 12, 0, tzinfo=timezone.utc)
        self.log_name = "projects/mobileid-478800/logs/run.googleapis.com%2Fstdout"
        self.trace = ""
        self.labels = {"instanceId": "abc123"}


def test_fetch_cloud_run_logs_handles_generator_response():
    client = Mock()
    client.list_entries.return_value = iter([
        FakeLogEntry(payload="first line"),
        FakeLogEntry(payload={"message": "structured log"}, severity="ERROR"),
    ])

    with (
        patch(
            "monitor.services.cloud_logging.service_account.Credentials.from_service_account_info",
            return_value=object(),
        ),
        patch("monitor.services.cloud_logging.logging_v2.Client", return_value=client),
    ):
        result = fetch_cloud_run_logs(
            service_account_key_json='{"client_email":"svc@example.com"}',
            project_id="mobileid-478800",
            service_name="cyberlens-backend",
            max_entries=2,
            hours_back=1,
            severity="error",
            text_filter='status="500"',
        )

    assert len(result["entries"]) == 2
    assert result["entries"][0]["message"] == "first line"
    assert result["entries"][1]["message"] == "structured log"
    assert result["entries"][1]["severity"] == "ERROR"
    assert "next_page_token" not in result

    _, kwargs = client.list_entries.call_args
    assert kwargs["max_results"] == 2
    assert kwargs["order_by"] == "timestamp desc"
    assert 'resource.type="cloud_run_revision"' in kwargs["filter_"]
    assert 'resource.labels.service_name="cyberlens-backend"' in kwargs["filter_"]
    assert "severity>=ERROR" in kwargs["filter_"]
    assert 'textPayload:"status=\\"500\\""' in kwargs["filter_"]
