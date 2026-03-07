from django.urls import path
from . import views

urlpatterns = [
    path("connect/", views.connect, name="github-connect"),
    path("disconnect/", views.disconnect, name="github-disconnect"),
    path("repos/", views.repos, name="github-repos"),
    path("scan/", views.scan, name="github-scan"),
    path("scan/<int:scan_id>/", views.scan_detail, name="github-scan-detail"),
    path("scan/<int:scan_id>/ai-report/", views.ai_report, name="github-ai-report"),
]
