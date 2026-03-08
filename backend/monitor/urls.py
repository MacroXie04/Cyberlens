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
    # GCP Estate
    path("gcp-estate/summary/", views.gcp_estate_summary, name="gcp-estate-summary"),
    path("gcp-estate/services/", views.gcp_estate_services, name="gcp-estate-services"),
    path("gcp-estate/timeseries/", views.gcp_estate_timeseries, name="gcp-estate-timeseries"),
    path("gcp-estate/timeline/", views.gcp_estate_timeline, name="gcp-estate-timeline"),
    path("gcp-estate/replay-snapshot/", views.gcp_estate_replay_snapshot, name="gcp-estate-replay-snapshot"),
    path("gcp-estate/refresh/", views.gcp_trigger_refresh, name="gcp-estate-refresh"),
    path("gcp-estate/ensure-collection/", views.gcp_ensure_collection, name="gcp-ensure-collection"),
    path("gcp-estate/ensure-history/", views.gcp_ensure_history, name="gcp-ensure-history"),
    # GCP Security
    path("gcp-security/events/", views.gcp_security_events, name="gcp-security-events"),
    path("gcp-security/incidents/", views.gcp_security_incidents, name="gcp-security-incidents"),
    path("gcp-security/incidents/<int:incident_id>/", views.gcp_security_incident_detail, name="gcp-security-incident-detail"),
    path("gcp-security/incidents/<int:incident_id>/ack/", views.gcp_security_incident_ack, name="gcp-security-incident-ack"),
    path("gcp-security/map/", views.gcp_security_map, name="gcp-security-map"),
]
