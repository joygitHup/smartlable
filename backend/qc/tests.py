"""qc(F11) 最小测试：模型、序列化器、工具与路由。"""
from django.test import TestCase
from django.urls import resolve

from core.models import User
from tasks.models import Task

from .models import Appeal, GoldSample, ReworkTask
from .serializers import GoldSampleListSerializer
from .utils import as_list, same_label


class QcUnitTest(TestCase):
    def test_utils(self):
        self.assertEqual(as_list("a,b, c"), ["a", "b", "c"])
        self.assertEqual(as_list(None), [])
        self.assertTrue(same_label({"label": "x"}, {"label": "x"}))
        self.assertFalse(same_label({"label": "x"}, {"label": "y"}))

    def test_gold_sample_serializer(self):
        user = User.objects.create_user(username="op", password="x", role="operator")
        task = Task.objects.create(name="t1", created_by=user)
        sample = GoldSample.objects.create(task=task, content="hi", expected_label={"label": "a"}, created_by=user)
        data = GoldSampleListSerializer(sample).data
        self.assertEqual(data["content"], "hi")
        self.assertEqual(data["created_by"], "op")

    def test_misc_models(self):
        user = User.objects.create_user(username="ann", password="x", role="annotator")
        task = Task.objects.create(name="t2", created_by=user)
        rework = ReworkTask.objects.create(task=task, reason="错标")
        self.assertEqual(rework.status, "pending")
        appeal = Appeal.objects.create(annotator=user, reason="误判")
        self.assertEqual(appeal.status, "open")


class QcRoutesTest(TestCase):
    def test_routes_resolve(self):
        self.assertEqual(resolve("/api/v1/qc/gold-samples").view_name, "qc-gold-sample-list")
        self.assertEqual(resolve("/api/v1/qc/cheat-detections").view_name, "qc-cheat-detection-list")
        self.assertEqual(resolve("/api/v1/qc/reworks").view_name, "qc-rework-list")
        self.assertEqual(resolve("/api/v1/qc/appeals").view_name, "qc-appeal-list")
        self.assertEqual(resolve("/api/v1/qc/trends").view_name, "qc-trends")
