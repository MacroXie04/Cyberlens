from django.urls import path
from . import views

urlpatterns = [
    path("status/", views.github_status, name="github-status"),
    path("connect/", views.connect, name="github-connect"),
    path("disconnect/", views.disconnect, name="github-disconnect"),
    path("repos/", views.repos, name="github-repos"),
    path("scans/", views.scans, name="github-scans"),
    path("scan/", views.scan, name="github-scan"),
    path("scan/<int:scan_id>/", views.scan_detail, name="github-scan-detail"),
    path("scan/<int:scan_id>/ai-report/", views.ai_report, name="github-ai-report"),
    path("scan/<int:scan_id>/code-findings/", views.code_findings, name="code-findings"),
    path("scan/<int:scan_id>/adk-trace/", views.adk_trace, name="adk-trace"),
    path("scan/<int:scan_id>/code-map/", views.code_map, name="code-map"),
    path("local/projects/", views.local_projects, name="local-projects"),
    path("local/scan/", views.local_scan, name="local-scan"),
]
