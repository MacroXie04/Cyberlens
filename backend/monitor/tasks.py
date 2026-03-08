# Re-export Celery tasks so autodiscover_tasks() can find them.
from .services.gcp_aggregator import (  # noqa: F401
    gcp_backfill_history,
    gcp_discover_services,
    gcp_fetch_logs,
    gcp_fetch_metrics,
    gcp_fetch_timeseries,
)
from .services.ai_analyzer import analyze_batch  # noqa: F401
