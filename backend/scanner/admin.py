from django.contrib import admin
from .models import GitHubScan, Dependency, Vulnerability, AiReport

admin.site.register(GitHubScan)
admin.site.register(Dependency)
admin.site.register(Vulnerability)
admin.site.register(AiReport)
