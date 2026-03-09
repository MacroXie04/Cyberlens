from django.db.models import Count
from rest_framework import status
from rest_framework.response import Response

from scanner.models import GitHubScan
from scanner.serializers import GitHubScanListSerializer


def scan_response(
    request,
    *,
    get_user_settings,
    dispatch_background_task,
    run_full_scan,
):
    user_settings = get_user_settings(request)
    pat = user_settings.github_pat
    if not pat:
        return Response({"error": "Not connected to GitHub"}, status=status.HTTP_401_UNAUTHORIZED)

    repo_full_name = request.data.get("repo")
    if not repo_full_name:
        return Response({"error": "repo is required"}, status=status.HTTP_400_BAD_REQUEST)

    scan_mode = request.data.get("scan_mode", GitHubScan.Mode.FAST)
    if scan_mode not in {GitHubScan.Mode.FAST, GitHubScan.Mode.FULL}:
        return Response({"error": "scan_mode must be 'fast' or 'full'"}, status=status.HTTP_400_BAD_REQUEST)

    github_scan = GitHubScan.objects.create(
        user=request.user,
        repo_name=repo_full_name,
        repo_url=f"https://github.com/{repo_full_name}",
        scan_mode=scan_mode,
        scan_status="scanning",
    )
    dispatch_background_task(
        run_full_scan,
        github_scan.id,
        pat,
        repo_full_name,
        user_id=request.user.id,
        scan_mode=scan_mode,
    )
    return Response(GitHubScanListSerializer(github_scan).data, status=status.HTTP_202_ACCEPTED)


def scans_response(request):
    repo_full_name = request.query_params.get("repo", "").strip()
    if not repo_full_name:
        return Response({"error": "repo query parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

    history = (
        GitHubScan.objects.filter(user=request.user, repo_name=repo_full_name)
        .annotate(code_findings_count=Count("code_findings"))
        .order_by("-scanned_at")
    )
    return Response(GitHubScanListSerializer(history, many=True).data)


def local_projects_response(request, *, list_local_projects):
    base_path = request.query_params.get("path", "")
    try:
        return Response(list_local_projects(base_path))
    except (ValueError, FileNotFoundError) as error:
        return Response({"error": str(error)}, status=status.HTTP_400_BAD_REQUEST)


def local_scan_response(
    request,
    *,
    dispatch_background_task,
    run_local_scan,
    validate_local_path,
):
    dir_path = request.data.get("path", "")
    if not dir_path:
        return Response({"error": "path is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_local_path(dir_path)
    except (ValueError, FileNotFoundError) as error:
        return Response({"error": str(error)}, status=status.HTTP_400_BAD_REQUEST)

    scan_mode = request.data.get("scan_mode", GitHubScan.Mode.FAST)
    if scan_mode not in {GitHubScan.Mode.FAST, GitHubScan.Mode.FULL}:
        return Response({"error": "scan_mode must be 'fast' or 'full'"}, status=status.HTTP_400_BAD_REQUEST)

    dir_name = dir_path.rstrip("/").split("/")[-1] or "root"
    github_scan = GitHubScan.objects.create(
        user=request.user,
        repo_name=f"local:{dir_name}",
        repo_url=dir_path,
        scan_source="local",
        scan_mode=scan_mode,
        scan_status="scanning",
    )
    dispatch_background_task(
        run_local_scan,
        github_scan.id,
        dir_path,
        user_id=request.user.id,
        scan_mode=scan_mode,
    )
    return Response(GitHubScanListSerializer(github_scan).data, status=status.HTTP_202_ACCEPTED)
