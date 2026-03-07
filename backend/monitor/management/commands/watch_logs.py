from django.core.management.base import BaseCommand
from monitor.services.log_watcher import start_watching


class Command(BaseCommand):
    help = "Watch Nginx log file and analyze incoming requests with AI"

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting log watcher..."))
        start_watching()
