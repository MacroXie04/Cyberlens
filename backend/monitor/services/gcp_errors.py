"""Helpers for surfacing actionable GCP collection failures."""

from __future__ import annotations


class GcpCollectionError(RuntimeError):
    """Raised when a GCP collection step fails in a user-actionable way."""


def format_exception_message(exc: Exception) -> str:
    message = str(exc).strip()
    if not message:
        return exc.__class__.__name__
    return message.splitlines()[0]


def extract_http_error_message(response) -> str:
    try:
        payload = response.json()
    except ValueError:
        payload = None

    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            message = error.get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()

    text = getattr(response, "text", "")
    if isinstance(text, str) and text.strip():
        return text.strip().splitlines()[0]

    status_code = getattr(response, "status_code", "unknown")
    return f"HTTP {status_code}"


def build_gcp_error_message(
    action: str,
    *,
    message: str,
    hint: str | None = None,
    status_code: int | None = None,
) -> str:
    prefix = f"{action} failed"
    if status_code is not None:
        prefix = f"{prefix} ({status_code})"

    normalized_message = message.strip().rstrip(".")
    full_message = f"{prefix}: {normalized_message}"
    if hint:
        full_message = f"{full_message}. {hint}"
    return full_message
