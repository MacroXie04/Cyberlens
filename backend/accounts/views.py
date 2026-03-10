from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import UserSettings
from .serializers import UserSerializer, RegisterSerializer, LoginSerializer


@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    UserSettings.objects.create(user=user)
    login(request, user)
    return Response(
        {"user": UserSerializer(user).data},
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = authenticate(
        request,
        username=serializer.validated_data["username"],
        password=serializer.validated_data["password"],
    )
    if user is None:
        return Response(
            {"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
        )
    login(request, user)
    return Response({"user": UserSerializer(user).data})


@api_view(["POST"])
def logout_view(request):
    logout(request)
    return Response({"status": "logged_out"})


@api_view(["GET"])
def verify_session(request):
    if request.user.is_authenticated:
        return Response({"status": "authenticated"})
    return Response({"error": "unauthenticated"}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def me_view(request):
    if not request.user.is_authenticated:
        return Response({"authenticated": False})
    user = request.user
    settings = getattr(user, "settings", None)
    if settings is None:
        settings = UserSettings.objects.create(user=user)
    return Response({
        "authenticated": True,
        "user": UserSerializer(user).data,
        "google_api_key_set": bool(settings.google_api_key),
        "google_api_key_preview": (
            f"{settings.google_api_key[:8]}...{settings.google_api_key[-4:]}"
            if len(settings.google_api_key) > 12
            else ""
        ),
        "github_pat_set": bool(settings.github_pat),
        "gemini_model": settings.gemini_model,
        "cloud_run_url": settings.cloud_run_url,
    })
