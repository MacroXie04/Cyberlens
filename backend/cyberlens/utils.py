def get_google_api_key() -> str:
    """Return the Google API key, checking Redis cache first then Django settings."""
    from django.core.cache import cache
    from django.conf import settings
    return cache.get("google_api_key") or settings.GOOGLE_API_KEY


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
