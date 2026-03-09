from django.utils import timezone as tz
from rest_framework.decorators import api_view
from rest_framework.response import Response

from monitor.models import GcpObservedService

from .gcp_helpers import apply_service_filters, parse_cursor, parse_window, require_project
from .gcp_payloads import build_summary_payload, estate_timeseries_response, replay_snapshot_payload, service_snapshot
from .gcp_timeline import timeline_payload


@api_view(["GET"])
def gcp_estate_summary(request):
    project_id, error = require_project(request)
    if error:
        return error
    start, end = parse_window(request, default_minutes=15)
    services = apply_service_filters(
        GcpObservedService.objects.filter(user=request.user, project_id=project_id),
        request,
    )
    return Response(build_summary_payload(request.user, project_id, start, end, services=services))


@api_view(["GET"])
def gcp_estate_services(request):
    project_id, error = require_project(request)
    if error:
        return error
    return Response(service_snapshot(request.user, project_id, parse_cursor(request, tz.now()), request))


@api_view(["GET"])
def gcp_estate_timeseries(request):
    project_id, error = require_project(request)
    if error:
        return error
    start, end = parse_window(request, default_minutes=15)
    return Response(estate_timeseries_response(request.user, project_id, start, end, request))


@api_view(["GET"])
def gcp_estate_timeline(request):
    project_id, error = require_project(request)
    if error:
        return error
    try:
        start, end = parse_window(request, default_minutes=43200)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)
    bucket = request.query_params.get("bucket", "6h")
    return Response(timeline_payload(request.user, project_id, start, end, bucket, request))


@api_view(["GET"])
def gcp_estate_replay_snapshot(request):
    project_id, error = require_project(request)
    if error:
        return error
    try:
        _, end = parse_window(request, default_minutes=43200)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)
    cursor = parse_cursor(request, end)
    window_minutes = max(15, min(int(request.query_params.get("window_minutes", 1440)), 43200))
    return Response(replay_snapshot_payload(request.user, project_id, cursor, window_minutes, request))
