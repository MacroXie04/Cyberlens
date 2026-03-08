#!/bin/sh
set -e

echo "Running migrations..."
python manage.py migrate --noinput

echo "Creating superuser (skipped if already exists)..."
python manage.py createsuperuser --noinput 2>/dev/null || true

exec "$@"
