"""compliance(F12) 路由：/api/v1/ 前缀，复数资源名，末尾不带斜杠。"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AuditLogViewSet,
    ComplianceChecklistViewSet,
    ComplianceCheckResultViewSet,
    DataClassificationViewSet,
    DataClassPolicyViewSet,
    DataLifecyclePolicyViewSet,
    LifecycleApplyViewSet,
    SecureEnvironmentViewSet,
    WatermarkGenerateViewSet,
    WatermarkViewSet,
)

router = DefaultRouter(trailing_slash=False)
# 关闭 API root 视图，避免与其它 app 的 include 争抢 /api/v1/ 根路径
router.include_root_view = False

router.register("compliance/classifications", DataClassificationViewSet, basename="compliance-classification")
router.register("compliance/policies", DataClassPolicyViewSet, basename="compliance-policy")
router.register("compliance/watermarks", WatermarkViewSet, basename="compliance-watermark")
router.register("compliance/environments", SecureEnvironmentViewSet, basename="compliance-environment")
router.register("compliance/audit-logs", AuditLogViewSet, basename="compliance-audit-log")
router.register("compliance/lifecycle-policies", DataLifecyclePolicyViewSet, basename="compliance-lifecycle-policy")
router.register("compliance/checklists", ComplianceChecklistViewSet, basename="compliance-checklist")
router.register("compliance/checks", ComplianceCheckResultViewSet, basename="compliance-check")

urlpatterns = [
    path(
        "compliance/watermark",
        WatermarkGenerateViewSet.as_view({"post": "generate"}),
        name="compliance-watermark-generate",
    ),
    path(
        "compliance/lifecycle/apply",
        LifecycleApplyViewSet.as_view({"post": "apply"}),
        name="compliance-lifecycle-apply",
    ),
] + router.urls
