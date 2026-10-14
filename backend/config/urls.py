"""config URL Configuration"""
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("core.urls")),
    path("api/v1/", include("tasks.urls")),
    path("api/v1/", include("ai.urls")),
    path("api/v1/", include("quality.urls")),
    path("api/v1/", include("common.urls")),
    path("api/v1/", include("specs.urls")),
    path("api/v1/", include("workforce.urls")),
    path("api/v1/", include("prelabel.urls")),
    path("api/v1/", include("qc.urls")),
    path("api/v1/", include("compliance.urls")),
    path("api/v1/", include("integration.urls")),
    path("api/v1/", include("ops.urls")),
    path("api/v1/", include("llmops.urls")),
    # OpenAPI 文档
    path("api/schema", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]