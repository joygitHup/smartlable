"""Webhook 视图(F13.2)：CRUD + 测试投递 + 投递记录只读。"""
from rest_framework import viewsets
from rest_framework.decorators import action

from common.response import ok

from ..filters import filter_deliveries, filter_webhooks
from ..models import Webhook, WebhookDelivery
from ..pagination import IntegrationPagination
from ..permissions import IntegrationManagePermission, IntegrationReadPermission
from ..serializers import (
    WebhookDeliverySerializer,
    WebhookDetailSerializer,
    WebhookListSerializer,
    WebhookWriteSerializer,
)
from ..services import webhook_service
from .base import CreatorPreserveMixin, EnvelopeViewSetMixin


class WebhookViewSet(CreatorPreserveMixin, EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = Webhook.objects.select_related("created_by")
    pagination_class = IntegrationPagination

    def get_queryset(self):
        return filter_webhooks(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return WebhookListSerializer
        if self.action == "retrieve":
            return WebhookDetailSerializer
        return WebhookWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IntegrationReadPermission()]
        return [IntegrationManagePermission()]

    @action(detail=True, methods=["post"], url_path="test")
    def test(self, request, pk=None):
        event = request.data.get("event") or "test"
        payload = request.data.get("payload")
        delivery = webhook_service.send_test_delivery(self.get_object(), event, payload, request.user)
        return ok(WebhookDeliverySerializer(delivery).data)


class WebhookDeliveryViewSet(EnvelopeViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = WebhookDelivery.objects.select_related("webhook")
    serializer_class = WebhookDeliverySerializer
    pagination_class = IntegrationPagination

    def get_queryset(self):
        return filter_deliveries(super().get_queryset(), self.request.query_params)

    def get_permissions(self):
        return [IntegrationReadPermission()]
