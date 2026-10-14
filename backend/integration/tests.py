"""integration(F13) 最小测试：模型、序列化器、服务与路由。"""
from django.test import TestCase
from django.urls import resolve

from core.models import User
from tasks.models import Task, Unit

from .models import APIClient, DataSource, PushRecord, SSOConfig, TrainingPlatform, Webhook, WebhookDelivery
from .serializers import APIClientListSerializer
from .services import datasource_service, client_service, platform_service


class IntegrationUnitTest(TestCase):
    def test_client_serializer_and_rotate(self):
        user = User.objects.create_user(username="op3", password="x", role="admin")
        client = APIClient.objects.create(name="c1", key="ak_x", secret="s1", created_by=user)
        data = APIClientListSerializer(client).data
        self.assertEqual(data["name"], "c1")
        self.assertNotIn("secret", data)
        old_key = client.key
        client_service.rotate_client(client, user)
        self.assertNotEqual(client.key, old_key)

    def test_webhook_and_delivery(self):
        webhook = Webhook.objects.create(name="w1", url="http://example.com/hook", events=["unit.reviewed"])
        delivery = WebhookDelivery.objects.create(webhook=webhook, event="test", attempts=1, status="failed")
        self.assertEqual(delivery.status, "failed")

    def test_datasource_service(self):
        source = DataSource.objects.create(name="ds1", source_type="database", config={})
        result = datasource_service.test_connection(source)
        self.assertFalse(result["ok"])
        self.assertIn("host", result["missing"])

    def test_platform_push_without_endpoint(self):
        user = User.objects.create_user(username="op4", password="x", role="operator")
        task = Task.objects.create(name="tp", created_by=user)
        Unit.objects.create(task=task, content="x", status="reviewed", human_reviewed=True, human_label={"label": "a"})
        platform = TrainingPlatform.objects.create(name="p1", platform_type="custom", endpoint="")
        record = platform_service.push_results(platform, task, user)
        self.assertEqual(record.status, "failed")
        self.assertEqual(PushRecord.objects.count(), 1)

    def test_sso_config(self):
        cfg = SSOConfig.objects.create(name="sso1", provider="oidc")
        self.assertEqual(cfg.provider, "oidc")


class IntegrationRoutesTest(TestCase):
    def test_routes_resolve(self):
        self.assertEqual(resolve("/api/v1/integration/clients").view_name, "integration-client-list")
        self.assertEqual(resolve("/api/v1/integration/webhooks").view_name, "integration-webhook-list")
        self.assertEqual(resolve("/api/v1/integration/deliveries").view_name, "integration-delivery-list")
        self.assertEqual(resolve("/api/v1/integration/datasources").view_name, "integration-datasource-list")
        self.assertEqual(resolve("/api/v1/integration/platforms").view_name, "integration-platform-list")
        self.assertEqual(resolve("/api/v1/integration/sso-configs").view_name, "integration-sso-config-list")
        self.assertEqual(resolve("/api/v1/integration/sdk-info").view_name, "integration-sdk-info")
