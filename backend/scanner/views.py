import threading
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import GitHubScan
from .serializers import (
    GitHubScanSerializer,
    GitHubScanListSerializer,
    AiReportSerializer,
)
from .services.github_client import validate_token, list_repos
from .services.osv_scanner import run_full_scan


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

    # Run scan in background thread
    thread = threading.Thread(
        target=run_full_scan, args=(github_scan.id, pat, repo_full_name)
    )
    thread.daemon = True
    thread.start()

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
