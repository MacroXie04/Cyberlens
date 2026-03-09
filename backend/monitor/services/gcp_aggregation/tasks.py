import logging
from datetime import datetime, timedelta, timezone

from celery import shared_task
from django.contrib.auth import get_user_model

from monitor.models import GcpObservedService
from monitor.services.redis_publisher import publish_gcp_estate_snapshot, publish_gcp_timeseries_update

from .collection import collect_parsed_events, get_gcp_config, get_last_fetch_time, set_last_fetch_time
from .history import get_history_coverage
from .persistence import cleanup_old_data, persist_events, upsert_health_samples
from .snapshot import build_estate_snapshot
from .status_cache import DEFAULT_HISTORY_DAYS, _NOT_CONFIGURED_MSG, clear_collection_error, get_history_status, set_collection_error, set_history_status

logger = logging.getLogger(__name__)


def _get_user_and_config(user_id: int):
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return None, None
    return user, get_gcp_config(user)


@shared_task
def gcp_fetch_logs(user_id: int):
    user, config = _get_user_and_config(user_id)
    if not user:
        return
    if not config:
        set_collection_error(user_id, "logs", _NOT_CONFIGURED_MSG)
        return
    log_sources = [source for source in config["enabled_sources"] if source != "cloud_monitoring"]
    since = min(get_last_fetch_time(user_id, source) for source in log_sources) if log_sources else datetime.now(timezone.utc) - timedelta(seconds=30)
    parsed_events, source_errors = collect_parsed_events(project_id=config["project_id"], service_account_key_json=config["service_account_key_json"], enabled_sources=config["enabled_sources"], service_filters=config["service_filters"] or None, since=since, max_entries=500)
    if source_errors:
        for source_name, message in source_errors.items():
            set_collection_error(user_id, source_name, message)
    else:
        clear_collection_error(user_id, "logs")
    created_events = persist_events(user=user, project_id=config["project_id"], event_dicts=parsed_events, publish=True, run_rule_engine=True)
    if created_events or not source_errors:
        now = datetime.now(timezone.utc)
        for source in ("cloud_run_logs", "load_balancer", "cloud_armor", "iam_audit", "iap"):
            set_last_fetch_time(user_id, source, now)


@shared_task
def gcp_fetch_metrics(user_id: int):
    user, config = _get_user_and_config(user_id)
    if not user:
        return
    if not config:
        set_collection_error(user_id, "metrics", _NOT_CONFIGURED_MSG)
        return
    if "cloud_monitoring" not in config["enabled_sources"]:
        return
    from monitor.services.gcp_metrics_fetcher import fetch_service_metrics
    try:
        metrics = fetch_service_metrics(service_account_key_json=config["service_account_key_json"], project_id=config["project_id"])
    except Exception as exc:
        logger.exception("Failed to fetch Cloud Monitoring metrics for user %s", user_id)
        set_collection_error(user_id, "metrics", str(exc))
        return
    clear_collection_error(user_id, "metrics")
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    samples = []
    for service_name, metric in metrics.items():
        GcpObservedService.objects.filter(user=user, project_id=config["project_id"], service_name=service_name).update(request_rate=float(metric.get("request_count", 0) or 0), error_rate=0, p50_latency_ms=float(metric.get("latency_mean_ms", 0) or 0), p95_latency_ms=float(metric.get("latency_p95_ms", 0) or 0), instance_count=int(round(metric.get("container_instance_count", 0) or 0)))
        samples.append({"service_name": service_name, "region": metric.get("region", ""), "bucket_end": now, "requests": metric.get("request_count", 0), "errors": 0, "latency_p50_ms": metric.get("latency_mean_ms", 0), "latency_p95_ms": metric.get("latency_p95_ms", 0), "instances": metric.get("container_instance_count", 0), "cpu_utilization": metric.get("container_cpu", 0), "memory_utilization": metric.get("container_memory", 0), "max_concurrency": metric.get("container_max_concurrency", 0)})
    upsert_health_samples(user=user, project_id=config["project_id"], samples=samples, publish=True)


@shared_task
def gcp_fetch_timeseries(user_id: int):
    user, config = _get_user_and_config(user_id)
    if not user:
        return
    if not config:
        set_collection_error(user_id, "timeseries", _NOT_CONFIGURED_MSG)
        return
    if "cloud_monitoring" not in config["enabled_sources"]:
        return
    from monitor.services.gcp_metrics_fetcher import fetch_historical_service_health
    try:
        samples = fetch_historical_service_health(service_account_key_json=config["service_account_key_json"], project_id=config["project_id"], minutes_back=60, alignment_period_seconds=300)
    except Exception as exc:
        logger.exception("Failed to fetch timeseries for user %s", user_id)
        set_collection_error(user_id, "timeseries", str(exc))
        return
    upsert_health_samples(user=user, project_id=config["project_id"], samples=samples, publish=False)
    publish_gcp_timeseries_update([{"timestamp": sample["bucket_end"], "service": sample["service_name"], "value": sample.get("requests", 0)} for sample in samples])
    clear_collection_error(user_id, "timeseries")


@shared_task
def gcp_discover_services(user_id: int):
    user, config = _get_user_and_config(user_id)
    if not user:
        return
    if not config:
        set_collection_error(user_id, "discovery", _NOT_CONFIGURED_MSG)
        return
    from monitor.services.gcp_discovery import discover_services
    try:
        services = discover_services(service_account_key_json=config["service_account_key_json"], project_id=config["project_id"], regions=config["regions"] or None, service_filters=config["service_filters"] or None)
    except Exception as exc:
        logger.exception("Failed to discover Cloud Run services for user %s", user_id)
        set_collection_error(user_id, "discovery", str(exc))
        return
    clear_collection_error(user_id, "discovery")
    for service in services:
        GcpObservedService.objects.update_or_create(user=user, project_id=config["project_id"], service_name=service["service_name"], region=service["region"], defaults={"latest_revision": service.get("latest_revision", ""), "url": service.get("url", ""), "last_deployed_at": service.get("last_deployed_at")})
    publish_gcp_estate_snapshot(build_estate_snapshot(user, config["project_id"]))


@shared_task
def gcp_backfill_history(user_id: int, days: int = DEFAULT_HISTORY_DAYS):
    user, config = _get_user_and_config(user_id)
    if not user:
        return
    if not config:
        set_history_status(user_id, {"state": "failed", "message": _NOT_CONFIGURED_MSG})
        return
    set_history_status(user_id, {"state": "running", "days": days, "started_at": datetime.now(timezone.utc).isoformat(), "message": f"Backfilling last {days} days of GCP history"})
    try:
        from monitor.services.gcp_metrics_fetcher import fetch_historical_service_health

        metrics_samples = fetch_historical_service_health(service_account_key_json=config["service_account_key_json"], project_id=config["project_id"], minutes_back=days * 24 * 60, alignment_period_seconds=300)
        upsert_health_samples(user=user, project_id=config["project_id"], samples=metrics_samples, publish=False)
        since = datetime.now(timezone.utc) - timedelta(days=days)
        parsed_events, source_errors = collect_parsed_events(project_id=config["project_id"], service_account_key_json=config["service_account_key_json"], enabled_sources=config["enabled_sources"], service_filters=config["service_filters"] or None, since=since, max_entries=5000)
        persist_events(user=user, project_id=config["project_id"], event_dicts=parsed_events, publish=False, run_rule_engine=False)
        now = datetime.now(timezone.utc)
        for source in ("cloud_run_logs", "load_balancer", "cloud_armor", "iam_audit", "iap"):
            set_last_fetch_time(user_id, source, now)
        cleanup_old_data(user, config["project_id"])
        coverage_start, coverage_end = get_history_coverage(user, config["project_id"])
        set_history_status(user_id, {"state": "complete" if not source_errors else "partial", "days": days, "started_at": get_history_status(user_id).get("started_at"), "completed_at": now.isoformat(), "message": "History backfill complete" if not source_errors else "History backfill completed with partial log source errors", "coverage_start": coverage_start.isoformat() if coverage_start else None, "coverage_end": coverage_end.isoformat() if coverage_end else None, "source_errors": source_errors})
    except Exception as exc:
        logger.exception("Failed to backfill GCP history for user %s", user_id)
        set_history_status(user_id, {"state": "failed", "days": days, "completed_at": datetime.now(timezone.utc).isoformat(), "message": str(exc)})
