"""llmops(F15) 最小测试：模型、序列化器、工具与路由。"""
from django.db.models import Count
from django.test import TestCase
from django.urls import resolve

from core.models import User
from tasks.models import Task, Unit

from .models import DistillationJob, HallucinationCheck, LLMCostRecord, MultiRoundSession, PromptTemplate
from .serializers import PromptTemplateListSerializer
from .utils import same_label, to_int


class LlmopsUnitTest(TestCase):
    def test_utils(self):
        self.assertEqual(to_int("3"), 3)
        self.assertEqual(to_int("x", 9), 9)
        self.assertTrue(same_label({"label": "x"}, {"label": "x"}))
        self.assertFalse(same_label({"label": "x"}, {"label": "y"}))

    def test_prompt_serializer(self):
        PromptTemplate.objects.create(name="base", task_type="classification")
        template = PromptTemplate.objects.annotate(_version_count=Count("versions")).get(name="base")
        data = PromptTemplateListSerializer(template).data
        self.assertEqual(data["name"], "base")
        self.assertEqual(data["version_count"], 0)

    def test_misc_models(self):
        user = User.objects.create_user(username="eng", password="x", role="engineer")
        task = Task.objects.create(name="t", created_by=user)
        unit = Unit.objects.create(task=task, content="c")
        cost = LLMCostRecord.objects.create(model="m", prompt_tokens=10, completion_tokens=20, total_tokens=30)
        self.assertEqual(cost.total_tokens, 30)
        check = HallucinationCheck.objects.create(unit=unit)
        self.assertFalse(check.is_hallucination)
        job = DistillationJob.objects.create(name="d")
        self.assertEqual(job.status, "pending")
        session = MultiRoundSession.objects.create(task=task, unit=unit, current_round=1, max_round=2)
        self.assertEqual(session.status, "open")


class LlmopsRoutesTest(TestCase):
    def test_routes_resolve(self):
        self.assertEqual(resolve("/api/v1/llmops/prompts").view_name, "llmops-prompt-list")
        self.assertEqual(resolve("/api/v1/llmops/costs").view_name, "llmops-cost-list")
        self.assertEqual(resolve("/api/v1/llmops/costs/summary").view_name, "llmops-cost-summary")
        self.assertEqual(resolve("/api/v1/llmops/hallucinations").view_name, "llmops-hallucination-list")
        self.assertEqual(resolve("/api/v1/llmops/consistency").view_name, "llmops-consistency-list")
        self.assertEqual(resolve("/api/v1/llmops/distillations").view_name, "llmops-distillation-list")
        self.assertEqual(resolve("/api/v1/llmops/rounds").view_name, "llmops-round-list")
