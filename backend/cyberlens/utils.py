import requests

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


def get_user_gemini_model(user_id: int | None) -> str:
    """Return the user's preferred Gemini model, or the default."""
    if user_id is None:
        return DEFAULT_GEMINI_MODEL
    try:
        from accounts.models import UserSettings

        settings = UserSettings.objects.get(user_id=user_id)
        return settings.gemini_model or DEFAULT_GEMINI_MODEL
    except Exception:
        return DEFAULT_GEMINI_MODEL


def get_google_api_key(user=None, user_id: int | None = None) -> str:
    """Return the Google API key.

    Priority: user's key (if user provided) → Redis cache → Django settings.
    """
    from django.core.cache import cache
    from django.conf import settings

    if user_id is not None:
        try:
            from accounts.models import UserSettings

            user_settings = UserSettings.objects.get(user_id=user_id)
            if user_settings.google_api_key:
                return user_settings.google_api_key
        except Exception:
            pass

    if user and hasattr(user, "settings") and user.settings.google_api_key:
        return user.settings.google_api_key
    return cache.get("google_api_key") or settings.GOOGLE_API_KEY


def probe_gemini_api_connection(api_key: str) -> dict:
    """Check whether the Gemini API is reachable for the provided key."""
    if not api_key:
        return {
            "success": False,
            "status_code": None,
            "error_type": "missing_api_key",
            "message": "No Google API key configured",
        }

    try:
        resp = requests.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}",
            timeout=10,
        )
    except requests.RequestException as exc:
        return {
            "success": False,
            "status_code": None,
            "error_type": "connection_failed",
            "message": f"Gemini API connection failed: {exc}",
        }

    body_text = resp.text.lower()
    if resp.status_code == 200:
        return {
            "success": True,
            "status_code": 200,
            "error_type": "",
            "message": "Gemini API connection OK",
        }
    if resp.status_code == 429 or "quota" in body_text or "resource_exhausted" in body_text:
        return {
            "success": False,
            "status_code": resp.status_code,
            "error_type": "quota_exceeded",
            "message": "Gemini API quota exceeded or rate limited",
        }
    if resp.status_code in (400, 401, 403):
        return {
            "success": False,
            "status_code": resp.status_code,
            "error_type": "invalid_api_key",
            "message": "Gemini API key is invalid or not authorized",
        }
    return {
        "success": False,
        "status_code": resp.status_code,
        "error_type": "http_error",
        "message": f"Gemini API returned status {resp.status_code}",
    }


def clean_json_response(response_text: str) -> str:
    """Strip markdown formatting from LLM JSON responses."""
    text = response_text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def log_gemini_call(
    *,
    user_id=None,
    service,
    related_object_id=None,
    model_name=DEFAULT_GEMINI_MODEL,
    prompt_summary="",
    response_summary="",
    input_tokens=0,
    output_tokens=0,
    total_tokens=0,
    status="success",
    error_message="",
    duration_ms=0,
):
    """Create a GeminiLog record for auditing AI calls."""
    from accounts.models import GeminiLog

    GeminiLog.objects.create(
        user_id=user_id,
        service=service,
        related_object_id=related_object_id,
        model_name=model_name,
        prompt_summary=prompt_summary[:2000],
        response_summary=response_summary[:2000],
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        status=status,
        error_message=error_message,
        duration_ms=duration_ms,
    )
