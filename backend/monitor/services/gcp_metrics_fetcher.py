"""Fetch Cloud Monitoring metrics for Cloud Run services."""

from __future__ import annotations

import json
import logging

from google.cloud import monitoring_v3
from google.oauth2 import service_account

from .gcp_errors import GcpCollectionError, build_gcp_error_message, format_exception_message
from .gcp_metrics_fetcher_support import SERVICE_GROUP_FIELDS, make_aggregation, make_interval, metric_value, point_timestamp, series_labels

logger = logging.getLogger(__name__)


def _get_client(service_account_key_json: str):
    key_info = json.loads(service_account_key_json)
    credentials = service_account.Credentials.from_service_account_info(key_info)
    return monitoring_v3.MetricServiceClient(credentials=credentials)


def _list_aligned_series(*, client, project_id: str, metric_type: str, minutes_back: int, alignment_period_seconds: int, aligner, reducer=None, group_by_fields: list[str] | None = None) -> list[dict]:
    request = monitoring_v3.ListTimeSeriesRequest(
        name=f"projects/{project_id}",
        filter=f'metric.type="{metric_type}" AND resource.type="cloud_run_revision"',
        interval=make_interval(minutes_back),
        view=monitoring_v3.ListTimeSeriesRequest.TimeSeriesView.FULL,
        aggregation=make_aggregation(
            alignment_period_seconds=alignment_period_seconds,
            aligner=aligner,
            reducer=reducer,
            group_by_fields=group_by_fields,
        ),
    )
    rows = []
    for series in client.list_time_series(request=request):
        service_name, region = series_labels(series)
        for point in series.points:
            rows.append({"timestamp": point_timestamp(point), "service": service_name, "region": region, "value": metric_value(point)})
    return rows


def fetch_historical_service_health(*, service_account_key_json: str, project_id: str, minutes_back: int = 43200, alignment_period_seconds: int = 300) -> list[dict]:
    client = _get_client(service_account_key_json)
    metrics = [
        ("requests", "run.googleapis.com/request_count", monitoring_v3.Aggregation.Aligner.ALIGN_SUM, monitoring_v3.Aggregation.Reducer.REDUCE_SUM),
        ("instances", "run.googleapis.com/container/instance_count", monitoring_v3.Aggregation.Aligner.ALIGN_MAX, monitoring_v3.Aggregation.Reducer.REDUCE_SUM),
        ("latency_p50_ms", "run.googleapis.com/request_latencies", monitoring_v3.Aggregation.Aligner.ALIGN_PERCENTILE_50, monitoring_v3.Aggregation.Reducer.REDUCE_MEAN),
        ("latency_p95_ms", "run.googleapis.com/request_latencies", monitoring_v3.Aggregation.Aligner.ALIGN_PERCENTILE_95, monitoring_v3.Aggregation.Reducer.REDUCE_MEAN),
    ]
    history, errors = {}, []
    for field_name, metric_type, aligner, reducer in metrics:
        try:
            rows = _list_aligned_series(client=client, project_id=project_id, metric_type=metric_type, minutes_back=minutes_back, alignment_period_seconds=alignment_period_seconds, aligner=aligner, reducer=reducer, group_by_fields=SERVICE_GROUP_FIELDS)
            for row in rows:
                key = (row["service"], row["region"], row["timestamp"])
                existing = history.setdefault(key, {"service_name": row["service"], "region": row["region"], "bucket_end": row["timestamp"], "requests": 0.0, "errors": 0.0, "latency_p50_ms": 0.0, "latency_p95_ms": 0.0, "instances": 0.0, "cpu_utilization": 0.0, "memory_utilization": 0.0})
                existing[field_name] = row["value"]
        except Exception as exc:
            logger.exception("Failed to fetch aligned metric %s", metric_type)
            errors.append(exc)
    if errors and not history:
        raise GcpCollectionError(build_gcp_error_message("Cloud Monitoring metrics collection", message=format_exception_message(errors[0]), hint="Enable the Cloud Monitoring API and grant the service account roles/monitoring.viewer."))
    return sorted(history.values(), key=lambda item: item["bucket_end"])


def fetch_service_metrics(*, service_account_key_json: str, project_id: str, minutes_back: int = 5) -> dict[str, dict]:
    samples = fetch_historical_service_health(service_account_key_json=service_account_key_json, project_id=project_id, minutes_back=minutes_back, alignment_period_seconds=max(minutes_back * 60, 300))
    return {
        sample["service_name"]: {
            "service_name": sample["service_name"],
            "region": sample["region"],
            "request_count": sample["requests"],
            "latency_mean_ms": sample["latency_p50_ms"],
            "latency_p95_ms": sample["latency_p95_ms"],
            "container_instance_count": sample["instances"],
            "container_cpu": sample["cpu_utilization"],
            "container_memory": sample["memory_utilization"],
            "container_max_concurrency": 0,
        }
        for sample in samples
    }


def fetch_timeseries(*, service_account_key_json: str, project_id: str, metric_type: str = "run.googleapis.com/request_count", minutes_back: int = 60, alignment_period_seconds: int = 60) -> list[dict]:
    client = _get_client(service_account_key_json)
    try:
        rows = _list_aligned_series(client=client, project_id=project_id, metric_type=metric_type, minutes_back=minutes_back, alignment_period_seconds=alignment_period_seconds, aligner=monitoring_v3.Aggregation.Aligner.ALIGN_SUM, reducer=monitoring_v3.Aggregation.Reducer.REDUCE_SUM, group_by_fields=SERVICE_GROUP_FIELDS)
    except Exception as exc:
        logger.exception("Failed to fetch timeseries %s", metric_type)
        raise GcpCollectionError(build_gcp_error_message("Cloud Monitoring timeseries collection", message=format_exception_message(exc), hint="Enable the Cloud Monitoring API and grant the service account roles/monitoring.viewer.")) from exc
    return sorted(rows, key=lambda item: item["timestamp"])
