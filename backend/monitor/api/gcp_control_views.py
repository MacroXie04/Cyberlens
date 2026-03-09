from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .gcp_helpers import require_project


@api_view(["POST"])
def gcp_trigger_refresh(request):
    project_id, error = require_project(request)
    if error:
        return Response(
            {"error": "GCP project not configured. Set project ID and service account key in Settings."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from monitor.services.gcp_aggregator import _collection_errors_key, gcp_discover_services, gcp_fetch_logs, gcp_fetch_metrics, gcp_fetch_timeseries

    cache.delete(_collection_errors_key(request.user.id))
    gcp_discover_services.delay(request.user.id)
    gcp_fetch_logs.delay(request.user.id)
    gcp_fetch_metrics.delay(request.user.id)
    gcp_fetch_timeseries.delay(request.user.id)
    return Response({"status": "refresh_triggered"})


@api_view(["POST"])
def gcp_ensure_collection(request):
    user_id = request.user.id
    cooldown_key = f"gcp_last_collection:{user_id}"
    if cache.get(cooldown_key):
        return Response({"triggered": False})
    project_id, error = require_project(request)
    if error:
        return Response({"triggered": False, "error": "GCP not configured"})

    from monitor.services.gcp_aggregator import gcp_discover_services, gcp_fetch_logs, gcp_fetch_metrics, gcp_fetch_timeseries

    gcp_discover_services.delay(user_id)
    gcp_fetch_logs.delay(user_id)
    gcp_fetch_metrics.delay(user_id)
    gcp_fetch_timeseries.delay(user_id)
    cache.set(cooldown_key, True, timeout=15)
    return Response({"triggered": True})


@api_view(["POST"])
def gcp_ensure_history(request):
    project_id, error = require_project(request)
    if error:
        return Response({"triggered": False, "error": "GCP not configured"})

    from monitor.services.gcp_aggregator import _history_trigger_key, gcp_backfill_history, get_history_status

    days = max(1, min(int(request.data.get("days", 30)), 30))
    trigger_key = _history_trigger_key(request.user.id, days)
    if cache.get(trigger_key):
        return Response({"triggered": False, "history_status": get_history_status(request.user.id)})
    gcp_backfill_history.delay(request.user.id, days)
    cache.set(trigger_key, True, timeout=300)
    return Response({"triggered": True, "history_status": get_history_status(request.user.id)})
