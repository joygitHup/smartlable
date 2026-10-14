"""specs(F8) 路由：/api/v1/ 前缀，复数资源名，末尾不带斜杠。"""
from rest_framework.routers import DefaultRouter

from .views import (
    DisputeSampleViewSet,
    SpecDocumentViewSet,
    TrainingAttemptViewSet,
    TrainingSetViewSet,
)

router = DefaultRouter(trailing_slash=False)
# 关闭 API root 视图，避免与其它 app 的 include 争抢 /api/v1/ 根路径
router.include_root_view = False

router.register("specs", SpecDocumentViewSet, basename="spec")
router.register("disputes", DisputeSampleViewSet, basename="dispute")
router.register("training/quizzes", TrainingSetViewSet, basename="training-quiz")
router.register("training/attempts", TrainingAttemptViewSet, basename="training-attempt")

urlpatterns = router.urls
