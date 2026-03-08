from django.urls import include, path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"requests", views.HttpRequestViewSet)
router.register(r"alerts", views.AlertViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("stats/overview/", views.stats_overview, name="stats-overview"),
    path("stats/timeline/", views.stats_timeline, name="stats-timeline"),
    path("stats/geo/", views.stats_geo, name="stats-geo"),
    path("verify-session/", views.verify_session, name="verify-session"),
    path("cloud-run-logs/", views.cloud_run_logs, name="cloud-run-logs"),
]
