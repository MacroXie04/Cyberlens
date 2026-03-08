#!/bin/sh
set -e

if [ "${RUN_DB_MIGRATIONS:-0}" = "1" ]; then
  echo "Running migrations..."
  python manage.py migrate --noinput
fi

exec "$@"
