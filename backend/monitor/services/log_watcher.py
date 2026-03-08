import json
import logging
import threading
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from django.conf import settings
from monitor.models import HttpRequest
from .ai_analyzer import analyze_batch

logger = logging.getLogger(__name__)

BATCH_SIZE = 15
BATCH_TIMEOUT = 5  # seconds


class LogFileHandler(FileSystemEventHandler):
    def __init__(self):
        self._file_pos = 0
        self._batch: list[int] = []
        self._batch_timer = None
        self._lock = threading.Lock()

    def on_modified(self, event):
        if event.src_path != settings.NGINX_LOG_PATH:
            return
        self._read_new_lines()

    def _read_new_lines(self):
        try:
            with open(settings.NGINX_LOG_PATH, "r") as f:
                f.seek(self._file_pos)
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    self._process_line(line)
                self._file_pos = f.tell()
        except FileNotFoundError:
            logger.warning("Log file not found: %s", settings.NGINX_LOG_PATH)

    def _process_line(self, line: str):
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            logger.warning("Invalid JSON log line: %s", line[:100])
            return

        req = HttpRequest.objects.create(
            ip=data.get("remote_addr", "0.0.0.0"),
            method=data.get("request_method", "GET"),
            path=data.get("request_uri", "/"),
            status=data.get("status", 0),
            user_agent=data.get("http_user_agent", ""),
            headers=data,
        )

        with self._lock:
            self._batch.append(req.id)
            if len(self._batch) >= BATCH_SIZE:
                self._flush_batch()
            elif self._batch_timer is None:
                self._batch_timer = threading.Timer(BATCH_TIMEOUT, self._flush_batch)
                self._batch_timer.start()

    def _flush_batch(self):
        with self._lock:
            if self._batch_timer:
                self._batch_timer.cancel()
                self._batch_timer = None
            batch = self._batch[:]
            self._batch = []

        if batch:
            logger.info("Analyzing batch of %d requests", len(batch))
            analyze_batch.delay(batch)


def start_watching():
    """Start watching the Nginx log file for new entries."""
    import os

    log_path = settings.NGINX_LOG_PATH
    log_dir = os.path.dirname(log_path)

    if not os.path.exists(log_dir):
        os.makedirs(log_dir, exist_ok=True)
    if not os.path.exists(log_path):
        open(log_path, "a").close()

    handler = LogFileHandler()
    observer = Observer()
    observer.schedule(handler, log_dir, recursive=False)
    observer.start()

    logger.info("Watching log file: %s", log_path)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
