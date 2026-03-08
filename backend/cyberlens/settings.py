import os
from pathlib import Path
from django.urls import reverse_lazy
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "insecure-dev-key-change-me")

DEBUG = os.getenv("DJANGO_DEBUG", "False").lower() in ("true", "1", "yes")

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

INSTALLED_APPS = [
    "unfold",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "accounts",
    "monitor",
    "scanner",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "cyberlens.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "cyberlens.wsgi.application"

# Database
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
        "OPTIONS": {
            "timeout": int(os.getenv("SQLITE_TIMEOUT_SECONDS", "20")),
        },
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS
CORS_ALLOWED_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",")
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = os.getenv(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

# REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}

# Cache
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# Celery (eager mode — tasks run synchronously in-process)
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = "cache+memory://"
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_BEAT_SCHEDULE = {}

# Nginx log path
NGINX_LOG_PATH = os.getenv("NGINX_LOG_PATH", "/var/log/nginx/access.json")

# Google Gemini / ADK
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

# django-unfold admin
UNFOLD = {
    "SITE_TITLE": "CyberLens",
    "SITE_HEADER": "CyberLens",
    "SITE_SUBHEADER": "Security Dashboard",
    "SITE_SYMBOL": "security",
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": False,
    "SIDEBAR": {
        "show_search": True,
        "navigation": [
            {
                "title": "Monitoring",
                "separator": True,
                "collapsible": False,
                "items": [
                    {
                        "title": "HTTP Requests",
                        "icon": "http",
                        "link": reverse_lazy("admin:monitor_httprequest_changelist"),
                    },
                    {
                        "title": "Analysis Results",
                        "icon": "query_stats",
                        "link": reverse_lazy("admin:monitor_analysisresult_changelist"),
                    },
                    {
                        "title": "Alerts",
                        "icon": "notifications_active",
                        "link": reverse_lazy("admin:monitor_alert_changelist"),
                    },
                ],
            },
            {
                "title": "Scanner",
                "separator": True,
                "collapsible": False,
                "items": [
                    {
                        "title": "Scans",
                        "icon": "radar",
                        "link": reverse_lazy("admin:scanner_githubscan_changelist"),
                    },
                    {
                        "title": "Dependencies",
                        "icon": "package_2",
                        "link": reverse_lazy("admin:scanner_dependency_changelist"),
                    },
                    {
                        "title": "Vulnerabilities",
                        "icon": "bug_report",
                        "link": reverse_lazy("admin:scanner_vulnerability_changelist"),
                    },
                    {
                        "title": "AI Reports",
                        "icon": "smart_toy",
                        "link": reverse_lazy("admin:scanner_aireport_changelist"),
                    },
                    {
                        "title": "Code Findings",
                        "icon": "code",
                        "link": reverse_lazy("admin:scanner_codefinding_changelist"),
                    },
                ],
            },
            {
                "title": "Accounts",
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": "Users",
                        "icon": "person",
                        "link": reverse_lazy("admin:auth_user_changelist"),
                    },
                    {
                        "title": "Groups",
                        "icon": "group",
                        "link": reverse_lazy("admin:auth_group_changelist"),
                    },
                    {
                        "title": "User Settings",
                        "icon": "settings",
                        "link": reverse_lazy("admin:accounts_usersettings_changelist"),
                    },
                    {
                        "title": "Gemini Logs",
                        "icon": "token",
                        "link": reverse_lazy("admin:accounts_geminilog_changelist"),
                    },
                ],
            },
        ],
    },
}
