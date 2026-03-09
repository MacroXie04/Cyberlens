from datetime import timedelta, timezone

from django.utils import timezone as tz
from django.utils.dateparse import parse_datetime


def get_user_project_id(request):
    project_id = request.query_params.get("project_id")
    if project_id:
        return project_id

    from accounts.models import UserSettings

    try:
        settings_obj = UserSettings.objects.get(user=request.user)
        return settings_obj.gcp_project_id
    except UserSettings.DoesNotExist:
        return None


def parse_minutes(request, default: int = 15) -> int:
    minutes = int(request.query_params.get("minutes", default))
    return max(1, min(minutes, 43200))


def parse_dt_param(name: str, value: str | None):
    if not value:
        return None
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    parsed = parse_datetime(value)
    if parsed is None:
        raise ValueError(f"Invalid {name}")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def parse_window(request, default_minutes: int = 15):
    start = parse_dt_param("start", request.query_params.get("start"))
    end = parse_dt_param("end", request.query_params.get("end"))
    if start and end:
        if start >= end:
            raise ValueError("start must be before end")
        return start, end
    end = tz.now()
    return end - timedelta(minutes=parse_minutes(request, default_minutes)), end


def parse_cursor(request, default_end):
    return parse_dt_param("cursor", request.query_params.get("cursor")) or default_end


def apply_event_filters(queryset, request):
    for field in ("region", "severity", "category", "source", "service"):
        value = request.query_params.get(field)
        if value:
            queryset = queryset.filter(**{field: value})
    return queryset


def apply_service_filters(queryset, request):
    if region := request.query_params.get("region"):
        queryset = queryset.filter(region=region)
    if service := request.query_params.get("service"):
        queryset = queryset.filter(service_name=service)
    return queryset


def history_metadata(user, project_id):
    from monitor.services.gcp_aggregator import get_history_metadata

    return get_history_metadata(user, project_id)


def service_total(services):
    return len(services) if isinstance(services, (list, tuple)) else services.count()


def service_error_rate(service) -> float:
    if isinstance(service, dict):
        return float(service.get("error_rate", 0) or 0)
    return float(getattr(service, "error_rate", 0) or 0)


def require_project(request):
    project_id = get_user_project_id(request)
    if not project_id:
        from rest_framework.response import Response

        return None, Response({"error": "GCP project not configured"}, status=400)
    return project_id, None
