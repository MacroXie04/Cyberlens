"""Fetch Cloud Monitoring metrics for Cloud Run services."""

import json
import logging
from datetime import datetime, timedelta, timezone

from google.cloud import monitoring_v3
from google.oauth2 import service_account
from google.protobuf.timestamp_pb2 import Timestamp

from .gcp_errors import (
    GcpCollectionError,
    build_gcp_error_message,
    format_exception_message,
)

logger = logging.getLogger(__name__)

# Cloud Run metric types we care about
METRIC_TYPES = {
    "request_count": "run.googleapis.com/request_count",
    "request_latencies": "run.googleapis.com/request_latencies",
    "container_instance_count": "run.googleapis.com/container/instance_count",
    "container_cpu": "run.googleapis.com/container/cpu/utilizations",
    "container_memory": "run.googleapis.com/container/memory/utilizations",
    "container_max_concurrency": "run.googleapis.com/container/max_request_concurrencies",
}


def _get_client(service_account_key_json: str):
    key_info = json.loads(service_account_key_json)
    credentials = service_account.Credentials.from_service_account_info(key_info)
    return monitoring_v3.MetricServiceClient(credentials=credentials)


def _make_interval(minutes_back: int = 5):
    now = datetime.now(timezone.utc)
    start = now - timedelta(minutes=minutes_back)

    end_ts = Timestamp()
    end_ts.FromDatetime(now)
    start_ts = Timestamp()
    start_ts.FromDatetime(start)

    return monitoring_v3.TimeInterval(start_time=start_ts, end_time=end_ts)


def fetch_service_metrics(
    *,
    service_account_key_json: str,
    project_id: str,
    minutes_back: int = 5,
) -> dict[str, dict]:
    """Fetch Cloud Run metrics for all services in a project.

    Returns {service_name: {metric_name: value, ...}, ...}
    """
    client = _get_client(service_account_key_json)
    project_name = f"projects/{project_id}"
    interval = _make_interval(minutes_back)

    results: dict[str, dict] = {}
    errors: list[Exception] = []

    for metric_key, metric_type in METRIC_TYPES.items():
        try:
            request = monitoring_v3.ListTimeSeriesRequest(
                name=project_name,
                filter=f'metric.type="{metric_type}" AND resource.type="cloud_run_revision"',
                interval=interval,
                view=monitoring_v3.ListTimeSeriesRequest.TimeSeriesView.FULL,
            )

            for ts in client.list_time_series(request=request):
                svc = ts.resource.labels.get("service_name", "unknown")
                if svc not in results:
                    results[svc] = {
                        "service_name": svc,
                        "region": ts.resource.labels.get("location", ""),
                        "revision": ts.resource.labels.get("revision_name", ""),
                    }

                # Extract latest point value
                if ts.points:
                    point = ts.points[0]
                    value = (
                        point.value.double_value
                        or point.value.int64_value
                        or point.value.distribution_value.mean
                        if hasattr(point.value, "distribution_value")
                        else 0
                    )
                    results[svc][metric_key] = value

                    # For latency distributions, extract percentiles
                    if metric_key == "request_latencies" and hasattr(
                        point.value, "distribution_value"
                    ):
                        dist = point.value.distribution_value
                        if dist.bucket_counts:
                            results[svc]["latency_mean_ms"] = dist.mean
        except Exception as exc:
            logger.exception("Failed to fetch metric %s", metric_type)
            errors.append(exc)

    if errors and not results:
        raise GcpCollectionError(
            build_gcp_error_message(
                "Cloud Monitoring metrics collection",
                message=format_exception_message(errors[0]),
                hint=(
                    "Enable the Cloud Monitoring API and grant the service "
                    "account roles/monitoring.viewer."
                ),
            )
        )

    return results


def fetch_timeseries(
    *,
    service_account_key_json: str,
    project_id: str,
    metric_type: str = "run.googleapis.com/request_count",
    minutes_back: int = 60,
    alignment_period_seconds: int = 60,
) -> list[dict]:
    """Fetch time-aligned metric series for charting.

    Returns list of {timestamp, service, value} dicts.
    """
    client = _get_client(service_account_key_json)
    project_name = f"projects/{project_id}"
    interval = _make_interval(minutes_back)

    from google.protobuf.duration_pb2 import Duration

    aggregation = monitoring_v3.Aggregation(
        alignment_period=Duration(seconds=alignment_period_seconds),
        per_series_aligner=monitoring_v3.Aggregation.Aligner.ALIGN_RATE,
        cross_series_reducer=monitoring_v3.Aggregation.Reducer.REDUCE_SUM,
        group_by_fields=["resource.labels.service_name"],
    )

    results = []
    try:
        request = monitoring_v3.ListTimeSeriesRequest(
            name=project_name,
            filter=f'metric.type="{metric_type}" AND resource.type="cloud_run_revision"',
            interval=interval,
            view=monitoring_v3.ListTimeSeriesRequest.TimeSeriesView.FULL,
            aggregation=aggregation,
        )

        for ts in client.list_time_series(request=request):
            svc = ts.resource.labels.get("service_name", "all")
            for point in ts.points:
                results.append({
                    "timestamp": point.interval.end_time.isoformat()
                    if hasattr(point.interval.end_time, "isoformat")
                    else str(point.interval.end_time),
                    "service": svc,
                    "value": point.value.double_value or point.value.int64_value,
                })
    except Exception as exc:
        logger.exception("Failed to fetch timeseries %s", metric_type)
        raise GcpCollectionError(
            build_gcp_error_message(
                "Cloud Monitoring timeseries collection",
                message=format_exception_message(exc),
                hint=(
                    "Enable the Cloud Monitoring API and grant the service "
                    "account roles/monitoring.viewer."
                ),
            )
        ) from exc

    return sorted(results, key=lambda x: x["timestamp"])
