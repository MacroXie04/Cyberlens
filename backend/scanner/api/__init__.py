import logging
import threading

from django.conf import settings as django_settings
from django.db import close_old_connections

logger = logging.getLogger(__name__)


def get_user_settings(request):
    from accounts.models import UserSettings

    settings_obj, _ = UserSettings.objects.get_or_create(user=request.user)
    return settings_obj


def run_eager_task_in_thread(task, args, kwargs):
    close_old_connections()
    try:
        task.apply(args=args, kwargs=kwargs)
    except Exception:
        logger.exception("Background eager task failed for %s", getattr(task, "name", task))
    finally:
        close_old_connections()


def dispatch_background_task(task, *args, **kwargs):
    task_name = getattr(task, "name", getattr(task, "__name__", "task"))

    if getattr(django_settings, "CELERY_TASK_ALWAYS_EAGER", False):
        try:
            thread = threading.Thread(
                target=run_eager_task_in_thread,
                args=(task, args, kwargs),
                daemon=True,
                name=f"{task_name}-thread",
            )
            thread.start()
            return
        except Exception:
            logger.exception("Background thread dispatch failed for %s; running inline", task_name)
            task.apply(args=args, kwargs=kwargs)
            return

    try:
        task.delay(*args, **kwargs)
    except Exception:
        logger.exception("Background task dispatch failed for %s; running inline", task_name)
        task.apply(args=args, kwargs=kwargs)
