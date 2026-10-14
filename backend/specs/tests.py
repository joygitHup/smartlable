"""specs(F8) 最小测试：模型、序列化器、工具与路由。"""
from django.test import TestCase
from django.urls import resolve

from core.models import User

from .models import SpecDocument, SpecVersion, SpecVersionStatus
from .serializers import SpecDocumentListSerializer
from .utils import line_diff


class SpecModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="eng", password="x", role="engineer")

    def test_spec_and_version(self):
        spec = SpecDocument.objects.create(title="情感规范", task_type="sentiment", created_by=self.user)
        ver = SpecVersion.objects.create(spec=spec, version=1, content="正向=积极", created_by=self.user)
        self.assertEqual(ver.status, SpecVersionStatus.DRAFT)
        self.assertEqual(spec.versions.count(), 1)

    def test_list_serializer_fields(self):
        spec = SpecDocument.objects.create(title="分类规范", task_type="classification", created_by=self.user)
        data = SpecDocumentListSerializer(spec).data
        self.assertEqual(data["title"], "分类规范")
        self.assertEqual(data["created_by"], "eng")

    def test_line_diff(self):
        diff = line_diff("a\nb\nc", "a\nc\nd")
        self.assertEqual(diff["added"], 1)
        self.assertEqual(diff["removed"], 1)


class SpecRoutesTest(TestCase):
    def test_routes_resolve(self):
        self.assertEqual(resolve("/api/v1/specs").view_name, "spec-list")
        self.assertEqual(resolve("/api/v1/disputes").view_name, "dispute-list")
        self.assertEqual(resolve("/api/v1/training/quizzes").view_name, "training-quiz-list")
