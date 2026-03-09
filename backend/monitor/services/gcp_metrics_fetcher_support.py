from datetime import datetime, timedelta, timezone

from google.cloud import monitoring_v3
from google.protobuf.timestamp_pb2 import Timestamp

SERVICE_GROUP_FIELDS = [
    "resource.labels.service_name",
    "resource.labels.location",
]


def make_interval(minutes_back: int):
    now = datetime.now(timezone.utc)
    start = now - timedelta(minutes=minutes_back)
    end_ts = Timestamp()
    end_ts.FromDatetime(now)
    start_ts = Timestamp()
    start_ts.FromDatetime(start)
    return monitoring_v3.TimeInterval(start_time=start_ts, end_time=end_ts)


def make_aggregation(*, alignment_period_seconds: int, aligner, reducer=None, group_by_fields: list[str] | None = None):
    from google.protobuf.duration_pb2 import Duration

    kwargs = {
        "alignment_period": Duration(seconds=alignment_period_seconds),
        "per_series_aligner": aligner,
    }
    if reducer is not None:
        kwargs["cross_series_reducer"] = reducer
    if group_by_fields:
        kwargs["group_by_fields"] = group_by_fields
    return monitoring_v3.Aggregation(**kwargs)


def metric_value(point) -> float:
    value = point.value
    if getattr(value, "double_value", None) not in (None, 0):
        return float(value.double_value)
    if getattr(value, "int64_value", None) not in (None, 0):
        return float(value.int64_value)
    distribution = getattr(value, "distribution_value", None)
    return float(getattr(distribution, "mean", 0) or 0) if distribution is not None else 0.0


def point_timestamp(point) -> str:
    end_time = point.interval.end_time
    if hasattr(end_time, "ToDatetime"):
        dt = end_time.ToDatetime()
        dt = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
        return dt.isoformat()
    if hasattr(end_time, "isoformat"):
        return end_time.isoformat()
    return str(end_time)


def series_labels(series) -> tuple[str, str]:
    resource_labels = getattr(series.resource, "labels", {}) or {}
    metric_labels = getattr(series.metric, "labels", {}) or {}
    service_name = resource_labels.get("service_name") or metric_labels.get("service_name") or "unknown"
    region = resource_labels.get("location") or metric_labels.get("location") or ""
    return service_name, region
