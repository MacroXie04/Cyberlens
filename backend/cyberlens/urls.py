from django.contrib import admin
from django.urls import include, path
from scanner.views import settings_view, test_api_key

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("monitor.urls")),
    path("api/github/", include("scanner.urls")),
    path("api/settings/", settings_view, name="settings"),
    path("api/settings/test-key/", test_api_key, name="test-api-key"),
]
