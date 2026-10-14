"""prelabel(F10) 最小测试：模型、序列化器、工具与路由。"""
from django.test import TestCase
from django.urls import resolve

from .models import ClassThreshold, PrelabelRule, RuleType
from .serializers import ClassThresholdListSerializer
from .utils import clamp, find_spans, match_rule


class PrelabelUnitTest(TestCase):
    def test_match_rule(self):
        self.assertTrue(match_rule("退款", "keyword", "我要退款"))
        self.assertFalse(match_rule("退款", "keyword", "正常收货"))
        self.assertTrue(match_rule(r"\d{6}", "regex", "订单号 123456"))

    def test_find_spans(self):
        spans = find_spans("ab", "keyword", "abxxab")
        self.assertEqual(len(spans), 2)
        self.assertEqual(spans[0], {"start": 0, "end": 2, "text": "ab"})

    def test_clamp(self):
        self.assertEqual(clamp(1.5, 0.0, 1.0), 1.0)

    def test_models(self):
        threshold = ClassThreshold.objects.create(task_type="classification", label="退款", threshold=0.9)
        self.assertEqual(str(threshold), "classification:退款@0.9")
        rule = PrelabelRule.objects.create(task_type="classification", name="退款规则", pattern="退款",
                                           label="退款", rule_type=RuleType.KEYWORD)
        self.assertTrue(rule.enabled)

    def test_serializer_fields(self):
        threshold = ClassThreshold.objects.create(task_type="sentiment", label="正向", threshold=0.8)
        data = ClassThresholdListSerializer(threshold).data
        self.assertEqual(data["label"], "正向")


class PrelabelRoutesTest(TestCase):
    def test_routes_resolve(self):
        self.assertEqual(resolve("/api/v1/prelabel/thresholds").view_name, "prelabel-threshold-list")
        self.assertEqual(resolve("/api/v1/prelabel/rules").view_name, "prelabel-rule-list")
        self.assertEqual(resolve("/api/v1/prelabel/long-tail").view_name, "prelabel-long-tail-list")
        self.assertEqual(resolve("/api/v1/prelabel/explain").view_name, "prelabel-explain")
