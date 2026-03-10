from django.contrib import admin
from django.urls import include, path
from scanner.views import available_models, settings_view, test_api_key

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/github/", include("scanner.urls")),
    path("api/settings/", settings_view, name="settings"),
    path("api/settings/test-key/", test_api_key, name="test-api-key"),
    path("api/settings/models/", available_models, name="available-models"),
]
