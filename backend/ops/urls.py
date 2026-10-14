"""ops(F14) 路由：/api/v1/ 前缀，复数资源名，末尾不带斜杠。"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AnnouncementViewSet,
    CommentViewSet,
    DashboardViewSet,
    FeedbackViewSet,
    LeaderboardViewSet,
    NotificationViewSet,
    ReportViewSet,
)

router = DefaultRouter(trailing_slash=False)
# 关闭 API root 视图，避免与其它 app 的 include 争抢 /api/v1/ 根路径
router.include_root_view = False

router.register("ops/comments", CommentViewSet, basename="ops-comment")
router.register("ops/announcements", AnnouncementViewSet, basename="ops-announcement")
router.register("ops/notifications", NotificationViewSet, basename="ops-notification")
router.register("ops/reports", ReportViewSet, basename="ops-report")
router.register("ops/feedbacks", FeedbackViewSet, basename="ops-feedback")

urlpatterns = [
    path("ops/dashboard", DashboardViewSet.as_view({"get": "dashboard"}), name="ops-dashboard"),
    path("ops/leaderboard", LeaderboardViewSet.as_view({"get": "leaderboard"}), name="ops-leaderboard"),
] + router.urls
