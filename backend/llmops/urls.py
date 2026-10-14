"""llmops(F15) 路由：/api/v1/ 前缀，复数资源名，末尾不带斜杠。"""
from rest_framework.routers import DefaultRouter

from .views import (
    ConsistencyReportViewSet,
    DistillationJobViewSet,
    HallucinationCheckViewSet,
    LLMCostRecordViewSet,
    MultiRoundSessionViewSet,
    PromptTemplateViewSet,
)

router = DefaultRouter(trailing_slash=False)
# 关闭 API root 视图，避免与其它 app 的 include 争抢 /api/v1/ 根路径
router.include_root_view = False

router.register("llmops/prompts", PromptTemplateViewSet, basename="llmops-prompt")
router.register("llmops/costs", LLMCostRecordViewSet, basename="llmops-cost")
router.register("llmops/hallucinations", HallucinationCheckViewSet, basename="llmops-hallucination")
router.register("llmops/consistency", ConsistencyReportViewSet, basename="llmops-consistency")
router.register("llmops/distillations", DistillationJobViewSet, basename="llmops-distillation")
router.register("llmops/rounds", MultiRoundSessionViewSet, basename="llmops-round")

urlpatterns = router.urls
