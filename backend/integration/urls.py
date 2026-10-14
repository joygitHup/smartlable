"""integration(F13) 路由：/api/v1/ 前缀，复数资源名，末尾不带斜杠。"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    APIClientViewSet,
    DataSourceViewSet,
    OpenAPITaskResultView,
    OpenAPITaskView,
    SDKInfoViewSet,
    SSOConfigViewSet,
    TrainingPlatformViewSet,
    WebhookDeliveryViewSet,
    WebhookViewSet,
)

router = DefaultRouter(trailing_slash=False)
# 关闭 API root 视图，避免与其它 app 的 include 争抢 /api/v1/ 根路径
router.include_root_view = False

router.register("integration/clients", APIClientViewSet, basename="integration-client")
router.register("integration/webhooks", WebhookViewSet, basename="integration-webhook")
router.register("integration/deliveries", WebhookDeliveryViewSet, basename="integration-delivery")
router.register("integration/datasources", DataSourceViewSet, basename="integration-datasource")
router.register("integration/platforms", TrainingPlatformViewSet, basename="integration-platform")
router.register("integration/sso-configs", SSOConfigViewSet, basename="integration-sso-config")

urlpatterns = [
    path("integration/sdk-info", SDKInfoViewSet.as_view({"get": "info"}), name="integration-sdk-info"),
    path("integration/open-api/tasks", OpenAPITaskView.as_view(), name="integration-open-api-task-create"),
    path(
        "integration/open-api/tasks/<int:tid>/results",
        OpenAPITaskResultView.as_view(),
        name="integration-open-api-task-results",
    ),
] + router.urls
