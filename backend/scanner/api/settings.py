import requests as http_requests
from django.core.cache import cache
from rest_framework import status
from rest_framework.response import Response


def _key_payload(user_settings):
    key = user_settings.google_api_key
    return {
        "google_api_key_set": bool(key),
        "google_api_key_preview": f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "",
        "gemini_model": user_settings.gemini_model,
    }


def settings_response(request, *, get_user_settings):
    user_settings = get_user_settings(request)
    if request.method == "GET":
        return Response(_key_payload(user_settings))

    new_key = request.data.get("google_api_key", "").strip()
    new_model = request.data.get("gemini_model")
    if not new_key and new_model is None:
        return Response(
            {"error": "google_api_key or gemini_model is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    update_fields = []
    if new_key:
        user_settings.google_api_key = new_key
        update_fields.append("google_api_key")
        cache.set("google_api_key", new_key, timeout=None)
    if new_model is not None:
        user_settings.gemini_model = new_model
        update_fields.append("gemini_model")
    if update_fields:
        user_settings.save(update_fields=update_fields)
    return Response(_key_payload(user_settings))


def test_api_key_response(request, *, get_user_settings, probe_gemini_api_connection, get_google_api_key):
    user_settings = get_user_settings(request)
    key = user_settings.google_api_key or get_google_api_key()
    if not key:
        return Response({"error": "No Google API key configured"}, status=status.HTTP_400_BAD_REQUEST)

    probe = probe_gemini_api_connection(key)
    if not probe["success"]:
        return Response(
            {"success": False, "error": probe["message"], "error_type": probe["error_type"]},
            status=status.HTTP_200_OK,
        )

    try:
        response = http_requests.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={key}",
            timeout=10,
        )
        models = response.json().get("models", []) if response.status_code == 200 else []
    except http_requests.RequestException:
        models = []
    return Response({"success": True, "models": [model.get("name", "") for model in models[:5]]})


def available_models_response(request, *, get_user_settings, get_google_api_key):
    user_settings = get_user_settings(request)
    key = user_settings.google_api_key or get_google_api_key()
    if not key:
        return Response({"error": "No Google API key configured"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        response = http_requests.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={key}",
            timeout=10,
        )
        if response.status_code != 200:
            return Response({"models": []})
        models = []
        for model in response.json().get("models", []):
            if "generateContent" in model.get("supportedGenerationMethods", []):
                models.append(model.get("name", "").replace("models/", ""))
        return Response({"models": models})
    except http_requests.RequestException:
        return Response({"models": []})


def gcp_settings_response(request, *, get_user_settings):
    user_settings = get_user_settings(request)

    def serialize_gcp(settings_obj):
        return {
            "gcp_project_id": settings_obj.gcp_project_id,
            "gcp_service_name": settings_obj.gcp_service_name,
            "gcp_region": settings_obj.gcp_region,
            "gcp_service_account_key_set": bool(settings_obj.gcp_service_account_key),
            "gcp_regions": settings_obj.gcp_regions or [],
            "gcp_service_filters": settings_obj.gcp_service_filters or [],
            "gcp_enabled_sources": settings_obj.gcp_enabled_sources or [],
        }

    if request.method == "GET":
        return Response(serialize_gcp(user_settings))

    update_fields = []
    for field in ("gcp_project_id", "gcp_service_name", "gcp_region"):
        value = request.data.get(field)
        if value is not None:
            setattr(user_settings, field, value.strip())
            update_fields.append(field)

    key_json = request.data.get("gcp_service_account_key")
    if key_json is not None:
        user_settings.gcp_service_account_key = key_json.strip()
        update_fields.append("gcp_service_account_key")

    for json_field in ("gcp_regions", "gcp_service_filters", "gcp_enabled_sources"):
        value = request.data.get(json_field)
        if value is not None:
            setattr(user_settings, json_field, value)
            update_fields.append(json_field)

    if not update_fields:
        return Response({"error": "No fields provided"}, status=status.HTTP_400_BAD_REQUEST)

    user_settings.save(update_fields=update_fields)
    return Response(serialize_gcp(user_settings))
