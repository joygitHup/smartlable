"""workforce(F9) 路由：/api/v1/ 前缀，复数资源名，末尾不带斜杠。"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AssignmentViewSet,
    AssignViewSet,
    EstimateViewSet,
    PaySchemeViewSet,
    ShiftViewSet,
    SkillTagViewSet,
    TaskQueueEntryViewSet,
    VendorTeamViewSet,
    WorkEstimateViewSet,
    WorklogViewSet,
)

router = DefaultRouter(trailing_slash=False)
# 关闭 API root 视图，避免与其它 app 的 include 争抢 /api/v1/ 根路径
router.include_root_view = False

router.register("workforce/queue", TaskQueueEntryViewSet, basename="wf-queue")
router.register("workforce/assignments", AssignmentViewSet, basename="wf-assignments")
router.register("workforce/skills", SkillTagViewSet, basename="wf-skills")
router.register("workforce/worklogs", WorklogViewSet, basename="wf-worklogs")
router.register("workforce/pay-schemes", PaySchemeViewSet, basename="wf-pay-schemes")
router.register("workforce/shifts", ShiftViewSet, basename="wf-shifts")
router.register("workforce/estimates", WorkEstimateViewSet, basename="wf-estimates")
router.register("workforce/vendors", VendorTeamViewSet, basename="wf-vendors")

urlpatterns = [
    path("workforce/assign", AssignViewSet.as_view({"post": "assign"}), name="wf-assign"),
    path("workforce/estimate", EstimateViewSet.as_view({"post": "create"}), name="wf-estimate"),
] + router.urls
