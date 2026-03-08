import pytest
from rest_framework.test import APIClient
from django.contrib.auth.models import User
from accounts.models import UserSettings


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
class TestRegister:
    def test_success(self, api_client):
        resp = api_client.post(
            "/api/auth/register/",
            {"username": "newuser", "email": "new@example.com", "password": "securepass123"},
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["username"] == "newuser"
        assert User.objects.filter(username="newuser").exists()
        assert UserSettings.objects.filter(user__username="newuser").exists()

    def test_duplicate_username(self, api_client, user_factory):
        user_factory(username="taken")
        resp = api_client.post(
            "/api/auth/register/",
            {"username": "taken", "email": "other@example.com", "password": "securepass123"},
            format="json",
        )
        assert resp.status_code == 400

    def test_duplicate_email(self, api_client, user_factory):
        user_factory(email="taken@example.com")
        resp = api_client.post(
            "/api/auth/register/",
            {"username": "other", "email": "taken@example.com", "password": "securepass123"},
            format="json",
        )
        assert resp.status_code == 400

    def test_short_password(self, api_client):
        resp = api_client.post(
            "/api/auth/register/",
            {"username": "user", "email": "u@example.com", "password": "short"},
            format="json",
        )
        assert resp.status_code == 400

    def test_missing_fields(self, api_client):
        resp = api_client.post("/api/auth/register/", {}, format="json")
        assert resp.status_code == 400


@pytest.mark.django_db
class TestLogin:
    def test_success(self, api_client, user_factory):
        user_factory(username="loginuser", password="testpass123")
        resp = api_client.post(
            "/api/auth/login/",
            {"username": "loginuser", "password": "testpass123"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["username"] == "loginuser"

    def test_wrong_password(self, api_client, user_factory):
        user_factory(username="loginuser", password="testpass123")
        resp = api_client.post(
            "/api/auth/login/",
            {"username": "loginuser", "password": "wrongpass"},
            format="json",
        )
        assert resp.status_code == 401

    def test_nonexistent_user(self, api_client):
        resp = api_client.post(
            "/api/auth/login/",
            {"username": "noone", "password": "testpass123"},
            format="json",
        )
        assert resp.status_code == 401


@pytest.mark.django_db
class TestLogout:
    def test_success(self, authenticated_client):
        resp = authenticated_client.post("/api/auth/logout/")
        assert resp.status_code == 200
        assert resp.data["status"] == "logged_out"

    def test_unauthenticated(self, api_client):
        resp = api_client.post("/api/auth/logout/")
        assert resp.status_code == 403


@pytest.mark.django_db
class TestMe:
    def test_authenticated(self, authenticated_client):
        resp = authenticated_client.get("/api/auth/me/")
        assert resp.status_code == 200
        assert resp.data["authenticated"] is True
        assert resp.data["user"]["username"] == "testuser"

    def test_unauthenticated(self, api_client):
        resp = api_client.get("/api/auth/me/")
        assert resp.status_code == 200
        assert resp.data["authenticated"] is False
