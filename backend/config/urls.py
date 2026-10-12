"""config URL Configuration"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("core.urls")),
    path("api/v1/", include("tasks.urls")),
    path("api/v1/", include("ai.urls")),
    path("api/v1/", include("quality.urls")),
]