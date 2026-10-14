"""prelabel(F10) 路由：/api/v1/ 前缀，复数资源名，末尾不带斜杠。"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ABExperimentViewSet,
    ClassThresholdViewSet,
    LongTailPolicyViewSet,
    PrelabelOperationsViewSet,
    PrelabelRecordViewSet,
    PrelabelRuleViewSet,
)

router = DefaultRouter(trailing_slash=False)
# 关闭 API root 视图，避免与其它 app 的 include 争抢 /api/v1/ 根路径
router.include_root_view = False

router.register("prelabel/thresholds", ClassThresholdViewSet, basename="prelabel-threshold")
router.register("prelabel/rules", PrelabelRuleViewSet, basename="prelabel-rule")
router.register("prelabel/records", PrelabelRecordViewSet, basename="prelabel-record")
router.register("prelabel/experiments", ABExperimentViewSet, basename="prelabel-experiment")
router.register("prelabel/long-tail", LongTailPolicyViewSet, basename="prelabel-long-tail")

urlpatterns = [
    path("prelabel/explain", PrelabelOperationsViewSet.as_view({"get": "explain"}), name="prelabel-explain"),
    path(
        "prelabel/compare",
        PrelabelOperationsViewSet.as_view({"get": "compare", "post": "compare"}),
        name="prelabel-compare",
    ),
    path("prelabel/fallback", PrelabelOperationsViewSet.as_view({"post": "fallback"}), name="prelabel-fallback"),
    path(
        "prelabel/apply-rules",
        PrelabelOperationsViewSet.as_view({"post": "apply_rules"}),
        name="prelabel-apply-rules",
    ),
] + router.urls
