import os
import threading
from django.conf import settings as django_settings
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import GitHubScan
from .serializers import (
    GitHubScanSerializer,
    GitHubScanListSerializer,
    AiReportSerializer,
    CodeFindingSerializer,
)
from .services.github_client import validate_token, list_repos
from .services.osv_scanner import run_full_scan, run_local_scan
from .services.local_client import list_local_projects, validate_local_path


@api_view(["GET"])
def github_status(request):
    """Check if a GitHub session is active."""
    pat = request.session.get("github_pat")
    if not pat:
        return Response({"connected": False})
    user_info = validate_token(pat)
    if user_info is None:
        request.session.pop("github_pat", None)
        return Response({"connected": False})
    return Response({
        "connected": True,
        "user": {
            "login": user_info["login"],
            "avatar_url": user_info["avatar_url"],
            "name": user_info.get("name"),
        },
    })


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

    request.session["github_pat"] = pat
    return Response(
        {
            "login": user_info.get("login"),
            "avatar_url": user_info.get("avatar_url"),
            "name": user_info.get("name"),
        }
    )


@api_view(["DELETE"])
def disconnect(request):
    request.session.pop("github_pat", None)
    return Response({"status": "disconnected"})


@api_view(["GET"])
def repos(request):
    pat = request.session.get("github_pat")
    if not pat:
        return Response(
            {"error": "Not connected to GitHub"}, status=status.HTTP_401_UNAUTHORIZED
        )

    repo_list = list_repos(pat)
    return Response(repo_list)


@api_view(["POST"])
def scan(request):
    pat = request.session.get("github_pat")
    if not pat:
        return Response(
            {"error": "Not connected to GitHub"}, status=status.HTTP_401_UNAUTHORIZED
        )

    repo_full_name = request.data.get("repo")
    if not repo_full_name:
        return Response(
            {"error": "repo is required"}, status=status.HTTP_400_BAD_REQUEST
        )

    github_scan = GitHubScan.objects.create(
        repo_name=repo_full_name,
        repo_url=f"https://github.com/{repo_full_name}",
        scan_status="scanning",
    )

    # Run scan via Celery
    run_full_scan.delay(github_scan.id, pat, repo_full_name)

    return Response(
        GitHubScanListSerializer(github_scan).data,
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(["GET"])
def scan_detail(request, scan_id):
    try:
        github_scan = GitHubScan.objects.get(id=scan_id)
    except GitHubScan.DoesNotExist:
        return Response(
            {"error": "Scan not found"}, status=status.HTTP_404_NOT_FOUND
        )
    return Response(GitHubScanSerializer(github_scan).data)


@api_view(["GET"])
def ai_report(request, scan_id):
    try:
        github_scan = GitHubScan.objects.get(id=scan_id)
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
def local_projects(request):
    """List available local project directories for scanning."""
    base_path = request.query_params.get("path", "")
    try:
        projects = list_local_projects(base_path)
        return Response(projects)
    except (ValueError, FileNotFoundError) as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def local_scan(request):
    """Trigger a dependency + code security scan on a local directory."""
    dir_path = request.data.get("path", "")
    if not dir_path:
        return Response(
            {"error": "path is required"}, status=status.HTTP_400_BAD_REQUEST
        )

    try:
        validate_local_path(dir_path)
    except (ValueError, FileNotFoundError) as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    dir_name = dir_path.rstrip("/").split("/")[-1] or "root"

    github_scan = GitHubScan.objects.create(
        repo_name=f"local:{dir_name}",
        repo_url=dir_path,
        scan_source="local",
        scan_status="scanning",
    )

    run_local_scan.delay(github_scan.id, dir_path)

    return Response(
        GitHubScanListSerializer(github_scan).data,
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(["GET"])
def code_findings(request, scan_id):
    """Get code security findings for a scan."""
    try:
        github_scan = GitHubScan.objects.get(id=scan_id)
    except GitHubScan.DoesNotExist:
        return Response(
            {"error": "Scan not found"}, status=status.HTTP_404_NOT_FOUND
        )
    findings = github_scan.code_findings.all()
    return Response(CodeFindingSerializer(findings, many=True).data)


@api_view(["GET", "PUT"])
def settings_view(request):
    """Get or update application settings (Google ADK key)."""
    if request.method == "GET":
        from cyberlens.utils import get_google_api_key
        key = get_google_api_key()
        return Response({
            "google_api_key_set": bool(key),
            "google_api_key_preview": f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "",
        })

    # PUT — update the key
    new_key = request.data.get("google_api_key", "").strip()
    if not new_key:
        return Response(
            {"error": "google_api_key is required"}, status=status.HTTP_400_BAD_REQUEST
        )

    django_settings.GOOGLE_API_KEY = new_key
    os.environ["GOOGLE_API_KEY"] = new_key

    from django.core.cache import cache
    cache.set("google_api_key", new_key, timeout=None)

    return Response({
        "google_api_key_set": True,
        "google_api_key_preview": f"{new_key[:8]}...{new_key[-4:]}" if len(new_key) > 12 else "",
    })


@api_view(["POST"])
def test_api_key(request):
    """Test the configured Google API key by making a lightweight Gemini call."""
    import requests as http_requests
    from cyberlens.utils import get_google_api_key

    key = get_google_api_key()
    if not key:
        return Response(
            {"error": "No Google API key configured"}, status=status.HTTP_400_BAD_REQUEST
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
        elif resp.status_code == 400 or resp.status_code == 403:
            return Response(
                {"success": False, "error": "Invalid API key"},
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {"success": False, "error": f"API returned status {resp.status_code}"},
                status=status.HTTP_200_OK,
            )
    except http_requests.RequestException as e:
        return Response(
            {"success": False, "error": f"Connection failed: {str(e)}"},
            status=status.HTTP_200_OK,
        )
