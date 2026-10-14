"""qc(F11) 路由：/api/v1/ 前缀，复数资源名，末尾不带斜杠。"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AnnotatorProfileViewSet,
    AppealViewSet,
    CheatDetectViewSet,
    CheatDetectionViewSet,
    CrossReviewAssignViewSet,
    CrossReviewViewSet,
    GoldInjectionViewSet,
    GoldInjectViewSet,
    GoldSampleViewSet,
    ProfileRebuildViewSet,
    QualityTrendViewSet,
    ReworkTaskViewSet,
    TrendsViewSet,
)

router = DefaultRouter(trailing_slash=False)
# 关闭 API root 视图，避免与其它 app 的 include 争抢 /api/v1/ 根路径
router.include_root_view = False

router.register("qc/gold-samples", GoldSampleViewSet, basename="qc-gold-sample")
router.register("qc/gold-injections", GoldInjectionViewSet, basename="qc-gold-injection")
router.register("qc/cheat-detections", CheatDetectionViewSet, basename="qc-cheat-detection")
router.register("qc/cross-reviews", CrossReviewViewSet, basename="qc-cross-review")
router.register("qc/profiles", AnnotatorProfileViewSet, basename="qc-profile")
router.register("qc/quality-trends", QualityTrendViewSet, basename="qc-quality-trend")
router.register("qc/reworks", ReworkTaskViewSet, basename="qc-rework")
router.register("qc/appeals", AppealViewSet, basename="qc-appeal")

urlpatterns = [
    path("qc/gold/inject", GoldInjectViewSet.as_view({"post": "gold_inject"}), name="qc-gold-inject"),
    path("qc/cheat/detect", CheatDetectViewSet.as_view({"post": "cheat_detect"}), name="qc-cheat-detect"),
    path("qc/cross-review", CrossReviewAssignViewSet.as_view({"post": "cross_review"}), name="qc-cross-review-assign"),
    path("qc/profiles/rebuild", ProfileRebuildViewSet.as_view({"post": "rebuild"}), name="qc-profile-rebuild"),
    path("qc/trends", TrendsViewSet.as_view({"get": "trends"}), name="qc-trends"),
] + router.urls
