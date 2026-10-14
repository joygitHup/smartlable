"""compliance(F12) 最小测试：模型、序列化器、工具、服务与路由。"""
from django.test import TestCase
from django.urls import resolve

from core.models import AuditLog, User
from tasks.models import Task, Unit

from .models import ComplianceCheckResult, ComplianceChecklist, DataClassification, DataLifecyclePolicy, Watermark
from .serializers import DataClassificationListSerializer
from .services import lifecycle_service, watermark_service
from .utils import content_hash, gen_token, parse_dt


class ComplianceUnitTest(TestCase):
    def test_utils(self):
        self.assertTrue(gen_token())
        self.assertEqual(len(content_hash("a", "b")), 64)
        self.assertIsNone(parse_dt(""))

    def test_classification_serializer(self):
        user = User.objects.create_user(username="op2", password="x", role="operator")
        obj = DataClassification.objects.create(name="客户数据", level="confidential", created_by=user)
        data = DataClassificationListSerializer(obj).data
        self.assertEqual(data["name"], "客户数据")
        self.assertEqual(data["created_by"], "op2")
        self.assertEqual(data["level_label"], "机密")

    def test_watermark_service(self):
        user = User.objects.create_user(username="adm2", password="x", role="admin")
        wm = watermark_service.generate_watermark("unit", 1, "水印", user=user)
        self.assertTrue(wm.token)
        self.assertEqual(len(wm.hash), 64)
        self.assertEqual(Watermark.objects.count(), 1)

    def test_lifecycle_service(self):
        user = User.objects.create_user(username="adm3", password="x", role="admin")
        task = Task.objects.create(name="t3", created_by=user)
        Unit.objects.create(task=task, content="x", status="created")
        DataLifecyclePolicy.objects.create(level="internal", retention_days=1, action="archive", created_by=user)
        result = lifecycle_service.apply_lifecycle_policies(user=user)
        self.assertEqual(result["total"], 1)

    def test_audit_and_check_models(self):
        user = User.objects.create_user(username="adm4", password="x", role="admin")
        AuditLog.objects.create(user=user, action="compliance:test", target_type="x", target_id="1")
        self.assertEqual(AuditLog.objects.count(), 1)
        item = ComplianceChecklist.objects.create(framework="PIPL", item="最小化采集")
        result = ComplianceCheckResult.objects.create(checklist=item)
        self.assertEqual(result.status, "pending")


class ComplianceRoutesTest(TestCase):
    def test_routes_resolve(self):
        self.assertEqual(resolve("/api/v1/compliance/classifications").view_name, "compliance-classification-list")
        self.assertEqual(resolve("/api/v1/compliance/watermarks").view_name, "compliance-watermark-list")
        self.assertEqual(resolve("/api/v1/compliance/audit-logs").view_name, "compliance-audit-log-list")
        self.assertEqual(
            resolve("/api/v1/compliance/lifecycle-policies").view_name, "compliance-lifecycle-policy-list"
        )
        self.assertEqual(resolve("/api/v1/compliance/checks").view_name, "compliance-check-list")
        self.assertEqual(resolve("/api/v1/compliance/watermark").view_name, "compliance-watermark-generate")
        self.assertEqual(resolve("/api/v1/compliance/lifecycle/apply").view_name, "compliance-lifecycle-apply")
