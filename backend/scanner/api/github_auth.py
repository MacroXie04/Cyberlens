from rest_framework import status
from rest_framework.response import Response


def github_status_response(request, *, get_user_settings, validate_token):
    user_settings = get_user_settings(request)
    pat = user_settings.github_pat
    if not pat:
        return Response({"connected": False})

    user_info = validate_token(pat)
    if user_info is None:
        user_settings.github_pat = ""
        user_settings.save(update_fields=["github_pat"])
        return Response({"connected": False})

    return Response(
        {
            "connected": True,
            "user": {
                "login": user_info["login"],
                "avatar_url": user_info["avatar_url"],
                "name": user_info.get("name"),
            },
        }
    )


def connect_response(request, *, get_user_settings, validate_token):
    pat = request.data.get("token", "")
    if not pat:
        return Response({"error": "Token is required"}, status=status.HTTP_400_BAD_REQUEST)

    user_info = validate_token(pat)
    if user_info is None:
        return Response({"error": "Invalid token"}, status=status.HTTP_401_UNAUTHORIZED)

    user_settings = get_user_settings(request)
    user_settings.github_pat = pat
    user_settings.save(update_fields=["github_pat"])
    return Response(
        {
            "login": user_info.get("login"),
            "avatar_url": user_info.get("avatar_url"),
            "name": user_info.get("name"),
        }
    )


def disconnect_response(request, *, get_user_settings):
    user_settings = get_user_settings(request)
    user_settings.github_pat = ""
    user_settings.save(update_fields=["github_pat"])
    return Response({"status": "disconnected"})


def repos_response(request, *, get_user_settings, list_repos):
    user_settings = get_user_settings(request)
    pat = user_settings.github_pat
    if not pat:
        return Response(
            {"error": "Not connected to GitHub"},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    return Response(list_repos(pat))
