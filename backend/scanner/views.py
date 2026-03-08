import os

import requests as http_requests
from django.conf import settings as django_settings
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import GitHubScan
from .serializers import (
    AiReportSerializer,
    CodeFindingSerializer,
    GitHubScanListSerializer,
    GitHubScanSerializer,
)
from .services.github_client import list_repos, validate_token
from .services.osv_scanner import run_full_scan


def _get_user_settings(request):
    """Get or create UserSettings for the authenticated user."""
    from accounts.models import UserSettings

    settings_obj, _ = UserSettings.objects.get_or_create(user=request.user)
    return settings_obj


@api_view(["GET"])
def github_status(request):
    """Check if a GitHub session is active."""
    user_settings = _get_user_settings(request)
    pat = user_settings.github_pat
    if not pat:
        return Response({"connected": False})
    user_info = validate_token(pat)
    if user_info is None:
        user_settings.github_pat = ""
        user_settings.save(update_fields=["github_pat"])
        return Response({"connected": False})
    return Response(
        {
            "connected": True,
            "user": {
                "login": user_info["login"],
                "avatar_url": user_info["avatar_url"],
                "name": user_info.get("name"),
            },
        }
    )


@api_view(["POST"])
def connect(request):
    pat = request.data.get("token", "")
    if not pat:
        return Response(
            {"error": "Token is required"}, status=status.HTTP_400_BAD_REQUEST
        )

    user_info = validate_token(pat)
    if user_info is None:
        return Response(
            {"error": "Invalid token"}, status=status.HTTP_401_UNAUTHORIZED
        )

    user_settings = _get_user_settings(request)
    user_settings.github_pat = pat
    user_settings.save(update_fields=["github_pat"])

    return Response(
        {
            "login": user_info.get("login"),
            "avatar_url": user_info.get("avatar_url"),
            "name": user_info.get("name"),
        }
    )


@api_view(["DELETE"])
def disconnect(request):
    user_settings = _get_user_settings(request)
    user_settings.github_pat = ""
    user_settings.save(update_fields=["github_pat"])
    return Response({"status": "disconnected"})


@api_view(["GET"])
def repos(request):
    user_settings = _get_user_settings(request)
    pat = user_settings.github_pat
    if not pat:
        return Response(
            {"error": "Not connected to GitHub"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    repo_list = list_repos(pat)
    return Response(repo_list)


@api_view(["POST"])
def scan(request):
    user_settings = _get_user_settings(request)
    pat = user_settings.github_pat
    if not pat:
        return Response(
            {"error": "Not connected to GitHub"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    repo_full_name = request.data.get("repo")
    if not repo_full_name:
        return Response(
            {"error": "repo is required"}, status=status.HTTP_400_BAD_REQUEST
        )

    github_scan = GitHubScan.objects.create(
        user=request.user,
        repo_name=repo_full_name,
        repo_url=f"https://github.com/{repo_full_name}",
        scan_status="scanning",
    )

    run_full_scan.delay(
        github_scan.id, pat, repo_full_name, user_id=request.user.id
    )

    return Response(
        GitHubScanListSerializer(github_scan).data,
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(["GET"])
def scan_detail(request, scan_id):
    try:
        github_scan = GitHubScan.objects.get(id=scan_id, user=request.user)
    except GitHubScan.DoesNotExist:
        return Response(
            {"error": "Scan not found"}, status=status.HTTP_404_NOT_FOUND
        )
    return Response(GitHubScanSerializer(github_scan).data)


@api_view(["GET"])
def ai_report(request, scan_id):
    try:
        github_scan = GitHubScan.objects.get(id=scan_id, user=request.user)
    except GitHubScan.DoesNotExist:
        return Response(
            {"error": "Scan not found"}, status=status.HTTP_404_NOT_FOUND
        )

    try:
        report = github_scan.ai_report
    except GitHubScan.ai_report.RelatedObjectDoesNotExist:
        return Response(
            {"error": "AI report not yet generated"},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(AiReportSerializer(report).data)


@api_view(["GET"])
def code_findings(request, scan_id):
    """Get code security findings for a scan."""
    try:
        github_scan = GitHubScan.objects.get(id=scan_id, user=request.user)
    except GitHubScan.DoesNotExist:
        return Response(
            {"error": "Scan not found"}, status=status.HTTP_404_NOT_FOUND
        )
    findings = github_scan.code_findings.all()
    return Response(CodeFindingSerializer(findings, many=True).data)


@api_view(["GET", "PUT"])
def settings_view(request):
    """Get or update application settings (Google ADK key, Gemini model)."""
    user_settings = _get_user_settings(request)

    if request.method == "GET":
        key = user_settings.google_api_key
        return Response(
            {
                "google_api_key_set": bool(key),
                "google_api_key_preview": (
                    f"{key[:8]}...{key[-4:]}" if len(key) > 12 else ""
                ),
                "gemini_model": user_settings.gemini_model,
            }
        )

    # PUT — update key and/or model
    new_key = request.data.get("google_api_key", "").strip()
    new_model = request.data.get("gemini_model")

    if not new_key and new_model is None:
        return Response(
            {"error": "google_api_key or gemini_model is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    update_fields = []
    if new_key:
        user_settings.google_api_key = new_key
        update_fields.append("google_api_key")
        cache.set("google_api_key", new_key, timeout=None)

    if new_model is not None:
        user_settings.gemini_model = new_model
        update_fields.append("gemini_model")

    if update_fields:
        user_settings.save(update_fields=update_fields)

    key = user_settings.google_api_key
    return Response(
        {
            "google_api_key_set": bool(key),
            "google_api_key_preview": (
                f"{key[:8]}...{key[-4:]}" if len(key) > 12 else ""
            ),
            "gemini_model": user_settings.gemini_model,
        }
    )


@api_view(["POST"])
def test_api_key(request):
    """Test the configured Google API key by making a lightweight Gemini call."""
    user_settings = _get_user_settings(request)
    key = user_settings.google_api_key
    if not key:
        from cyberlens.utils import get_google_api_key

        key = get_google_api_key()
    if not key:
        return Response(
            {"error": "No Google API key configured"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        resp = http_requests.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={key}",
            timeout=10,
        )
        if resp.status_code == 200:
            models = resp.json().get("models", [])
            model_names = [m.get("name", "") for m in models[:5]]
            return Response({"success": True, "models": model_names})
        elif resp.status_code in (400, 403):
            return Response(
                {"success": False, "error": "Invalid API key"},
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {
                    "success": False,
                    "error": f"API returned status {resp.status_code}",
                },
                status=status.HTTP_200_OK,
            )
    except http_requests.RequestException as e:
        return Response(
            {"success": False, "error": f"Connection failed: {str(e)}"},
            status=status.HTTP_200_OK,
        )


@api_view(["GET"])
def available_models(request):
    """List available Gemini models for the user's API key."""
    from cyberlens.utils import get_google_api_key

    user_settings = _get_user_settings(request)
    key = user_settings.google_api_key
    if not key:
        key = get_google_api_key()
    if not key:
        return Response(
            {"error": "No Google API key configured"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        resp = http_requests.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={key}",
            timeout=10,
        )
        if resp.status_code != 200:
            return Response({"models": []})

        models = resp.json().get("models", [])
        result = []
        for m in models:
            methods = m.get("supportedGenerationMethods", [])
            if "generateContent" in methods:
                name = m.get("name", "").replace("models/", "")
                result.append(name)
        return Response({"models": result})
    except http_requests.RequestException:
        return Response({"models": []})




@api_view(["GET", "PUT"])
def gcp_settings_view(request):
    """Get or update GCP Cloud Logging settings."""
    user_settings = _get_user_settings(request)

    if request.method == "GET":
        return Response({
            "gcp_project_id": user_settings.gcp_project_id,
            "gcp_service_name": user_settings.gcp_service_name,
            "gcp_region": user_settings.gcp_region,
            "gcp_service_account_key_set": bool(user_settings.gcp_service_account_key),
        })

    # PUT
    update_fields = []
    for field in ("gcp_project_id", "gcp_service_name", "gcp_region"):
        value = request.data.get(field)
        if value is not None:
            setattr(user_settings, field, value.strip())
            update_fields.append(field)

    key_json = request.data.get("gcp_service_account_key")
    if key_json is not None:
        user_settings.gcp_service_account_key = key_json.strip()
        update_fields.append("gcp_service_account_key")

    if not update_fields:
        return Response(
            {"error": "No fields provided"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user_settings.save(update_fields=update_fields)
    return Response({
        "gcp_project_id": user_settings.gcp_project_id,
        "gcp_service_name": user_settings.gcp_service_name,
        "gcp_region": user_settings.gcp_region,
        "gcp_service_account_key_set": bool(user_settings.gcp_service_account_key),
    })


@api_view(["GET"])
def local_projects(request):
    """List available local project directories for scanning."""
    from .services.local_client import list_local_projects as _list_lp  # noqa: E402
    base_path = request.query_params.get("path", "")
    try:
        projects = _list_lp(base_path)
        return Response(projects)
    except (ValueError, FileNotFoundError) as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def local_scan(request):
    """Trigger a dependency + code security scan on a local directory."""
    from .services.local_client import validate_local_path as _vlp  # noqa: E402
    from .services.osv_scanner import run_local_scan as _rls  # noqa: E402
    dir_path = request.data.get("path", "")
    if not dir_path:
        return Response(
            {"error": "path is required"}, status=status.HTTP_400_BAD_REQUEST
        )
    try:
        _vlp(dir_path)
    except (ValueError, FileNotFoundError) as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    dir_name = dir_path.rstrip("/").split("/")[-1] or "root"
    github_scan = GitHubScan.objects.create(
        user=request.user,
        repo_name=f"local:{dir_name}",
        repo_url=dir_path,
        scan_source="local",
        scan_status="scanning",
    )
    _rls.delay(github_scan.id, dir_path, user_id=request.user.id)
    return Response(
        GitHubScanListSerializer(github_scan).data,
        status=status.HTTP_202_ACCEPTED,
    )
