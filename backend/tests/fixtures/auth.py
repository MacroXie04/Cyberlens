import pytest
from django.contrib.auth.models import User


@pytest.fixture
def user_factory(db):
    def _create(**kwargs):
        defaults = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpass123",
        }
        defaults.update(kwargs)
        password = defaults.pop("password")
        return User.objects.create_user(password=password, **defaults)

    return _create


@pytest.fixture
def user_settings_factory(db):
    from accounts.models import UserSettings

    def _create(user, **kwargs):
        settings_obj, _ = UserSettings.objects.get_or_create(user=user, defaults=kwargs)
        for key, value in kwargs.items():
            setattr(settings_obj, key, value)
        if kwargs:
            settings_obj.save()
        return settings_obj

    return _create


@pytest.fixture
def authenticated_client(db, user_factory, user_settings_factory):
    from rest_framework.test import APIClient

    client = APIClient()
    user = user_factory()
    user_settings_factory(user)
    client.force_authenticate(user=user)
    client._user = user
    return client
