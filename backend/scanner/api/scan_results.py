from django.db.models import Count
from rest_framework import status
from rest_framework.response import Response

from scanner.models import GitHubScan
from scanner.serializers import AiReportSerializer, CodeFindingSerializer, GitHubScanSerializer


def scan_detail_response(request, scan_id):
    try:
        github_scan = (
            GitHubScan.objects.annotate(code_findings_count=Count("code_findings"))
            .get(id=scan_id, user=request.user)
        )
    except GitHubScan.DoesNotExist:
        return Response({"error": "Scan not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(GitHubScanSerializer(github_scan).data)


def ai_report_response(request, scan_id):
    try:
        github_scan = GitHubScan.objects.get(id=scan_id, user=request.user)
    except GitHubScan.DoesNotExist:
        return Response({"error": "Scan not found"}, status=status.HTTP_404_NOT_FOUND)

    try:
        report = github_scan.ai_report
    except GitHubScan.ai_report.RelatedObjectDoesNotExist:
        return Response(
            {"error": "AI report not yet generated"},
            status=status.HTTP_404_NOT_FOUND,
        )
    return Response(AiReportSerializer(report).data)


def code_findings_response(request, scan_id):
    try:
        github_scan = GitHubScan.objects.get(id=scan_id, user=request.user)
    except GitHubScan.DoesNotExist:
        return Response({"error": "Scan not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(CodeFindingSerializer(github_scan.code_findings.all(), many=True).data)


def adk_trace_response(request, scan_id, *, build_trace_snapshot):
    try:
        github_scan = GitHubScan.objects.get(id=scan_id, user=request.user)
    except GitHubScan.DoesNotExist:
        return Response({"error": "Scan not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(build_trace_snapshot(github_scan))
