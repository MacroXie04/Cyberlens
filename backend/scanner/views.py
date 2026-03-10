import logging
import threading

import requests as http_requests
from django.conf import settings as django_settings
from django.db import close_old_connections
from rest_framework.decorators import api_view

from cyberlens.utils import get_google_api_key, probe_gemini_api_connection

from .api.common import get_user_settings as _get_user_settings
from .api.github_auth import connect_response, disconnect_response, github_status_response, repos_response
from .api.scan_results import adk_trace_response, ai_report_response, code_findings_response, scan_detail_response
from .api.scan_runs import local_projects_response, local_scan_response, scan_response, scans_response
from .api.settings import available_models_response, settings_response, test_api_key_response
from .services.adk_trace import build_trace_snapshot
from .services.github_client import list_repos, validate_token
from .services.local_client import list_local_projects, validate_local_path
from .services.osv_scanner import run_full_scan, run_local_scan

logger = logging.getLogger(__name__)


def _run_eager_task_in_thread(task, args, kwargs):
    close_old_connections()
    try:
        task.apply(args=args, kwargs=kwargs)
    except Exception:
        logger.exception("Background eager task failed for %s", getattr(task, "name", task))
    finally:
        close_old_connections()


def _dispatch_background_task(task, *args, **kwargs):
    task_name = getattr(task, "name", getattr(task, "__name__", "task"))
    if getattr(django_settings, "CELERY_TASK_ALWAYS_EAGER", False):
        try:
            thread = threading.Thread(
                target=_run_eager_task_in_thread,
                args=(task, args, kwargs),
                daemon=True,
                name=f"{task_name}-thread",
            )
            thread.start()
            return
        except Exception:
            logger.exception("Background thread dispatch failed for %s; running inline", task_name)
            task.apply(args=args, kwargs=kwargs)
            return

    try:
        task.delay(*args, **kwargs)
    except Exception:
        logger.exception("Background task dispatch failed for %s; running inline", task_name)
        task.apply(args=args, kwargs=kwargs)


@api_view(["GET"])
def github_status(request):
    return github_status_response(request, get_user_settings=_get_user_settings, validate_token=validate_token)


@api_view(["POST"])
def connect(request):
    return connect_response(request, get_user_settings=_get_user_settings, validate_token=validate_token)


@api_view(["DELETE"])
def disconnect(request):
    return disconnect_response(request, get_user_settings=_get_user_settings)


@api_view(["GET"])
def repos(request):
    return repos_response(request, get_user_settings=_get_user_settings, list_repos=list_repos)


@api_view(["POST"])
def scan(request):
    return scan_response(
        request,
        get_user_settings=_get_user_settings,
        dispatch_background_task=_dispatch_background_task,
        run_full_scan=run_full_scan,
    )


@api_view(["GET"])
def scans(request):
    return scans_response(request)


@api_view(["GET"])
def scan_detail(request, scan_id):
    return scan_detail_response(request, scan_id)


@api_view(["GET"])
def ai_report(request, scan_id):
    return ai_report_response(request, scan_id)


@api_view(["GET"])
def code_findings(request, scan_id):
    return code_findings_response(request, scan_id)


@api_view(["GET"])
def adk_trace(request, scan_id):
    return adk_trace_response(request, scan_id, build_trace_snapshot=build_trace_snapshot)


@api_view(["GET", "PUT"])
def settings_view(request):
    return settings_response(request, get_user_settings=_get_user_settings)


@api_view(["POST"])
def test_api_key(request):
    return test_api_key_response(
        request,
        get_user_settings=_get_user_settings,
        probe_gemini_api_connection=probe_gemini_api_connection,
        get_google_api_key=get_google_api_key,
    )


@api_view(["GET"])
def available_models(request):
    return available_models_response(
        request,
        get_user_settings=_get_user_settings,
        get_google_api_key=get_google_api_key,
    )


@api_view(["GET"])
def local_projects(request):
    return local_projects_response(request, list_local_projects=list_local_projects)


@api_view(["POST"])
def local_scan(request):
    return local_scan_response(
        request,
        dispatch_background_task=_dispatch_background_task,
        run_local_scan=run_local_scan,
        validate_local_path=validate_local_path,
    )
