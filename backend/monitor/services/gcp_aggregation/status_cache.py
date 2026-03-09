from django.core.cache import cache

DEFAULT_HISTORY_DAYS = 30
_NOT_CONFIGURED_MSG = "GCP not configured - set project ID and service account key in Settings"


def _collection_errors_key(user_id: int) -> str:
    return f"gcp_collection_errors:{user_id}"


def set_collection_error(user_id: int, source: str, message: str) -> None:
    errors = cache.get(_collection_errors_key(user_id)) or {}
    errors[source] = message
    cache.set(_collection_errors_key(user_id), errors, timeout=300)


def clear_collection_error(user_id: int, source: str) -> None:
    errors = cache.get(_collection_errors_key(user_id))
    if errors and source in errors:
        del errors[source]
        cache.set(_collection_errors_key(user_id), errors, timeout=300)


def get_collection_errors(user_id: int) -> dict:
    return cache.get(_collection_errors_key(user_id)) or {}


def _history_status_key(user_id: int) -> str:
    return f"gcp_history_status:{user_id}"


def set_history_status(user_id: int, status: dict) -> None:
    cache.set(_history_status_key(user_id), status, timeout=3600)


def get_history_status(user_id: int) -> dict:
    return cache.get(_history_status_key(user_id)) or {"state": "idle"}


def _history_trigger_key(user_id: int, days: int) -> str:
    return f"gcp_history_backfill_triggered:{user_id}:{days}"
