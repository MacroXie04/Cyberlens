import pytest
from accounts.models import UserSettings


@pytest.mark.django_db
class TestUserSettings:
    def test_settings_created_on_register(self, db):
        from rest_framework.test import APIClient
        client = APIClient()
        resp = client.post(
            "/api/auth/register/",
            {"username": "settingsuser", "email": "s@example.com", "password": "securepass123"},
            format="json",
        )
        assert resp.status_code == 201
        assert UserSettings.objects.filter(user__username="settingsuser").exists()

    def test_save_api_key(self, authenticated_client):
        resp = authenticated_client.put(
            "/api/settings/",
            {"google_api_key": "AIzaTestKey12345678"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["google_api_key_set"] is True

    def test_get_settings(self, authenticated_client):
        resp = authenticated_client.get("/api/settings/")
        assert resp.status_code == 200
        assert "google_api_key_set" in resp.data

    def test_github_pat_stored_in_settings(self, authenticated_client):
        from unittest.mock import patch
        with patch("scanner.views.validate_token", return_value={"login": "u", "avatar_url": "", "name": "U"}):
            authenticated_client.post("/api/github/connect/", {"token": "ghp_test123"}, format="json")
        user = authenticated_client._user
        user.settings.refresh_from_db()
        assert user.settings.github_pat == "ghp_test123"
