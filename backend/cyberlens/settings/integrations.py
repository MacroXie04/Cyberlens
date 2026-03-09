import os

NGINX_LOG_PATH = os.getenv("NGINX_LOG_PATH", "/var/log/nginx/access.json")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
