from django.contrib import admin
from .models import HttpRequest, AnalysisResult, Alert

admin.site.register(HttpRequest)
admin.site.register(AnalysisResult)
admin.site.register(Alert)
