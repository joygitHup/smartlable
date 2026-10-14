"""Webhook 与投递记录序列化器(F13.2)。"""
from rest_framework import serializers

from ..models import Webhook, WebhookDelivery


def _username(user) -> str:
    return user.username if user else ""


class WebhookListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = Webhook
        fields = ["id", "name", "url", "events", "secret", "enabled", "created_by", "created_at", "updated_at"]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class WebhookDetailSerializer(WebhookListSerializer):
    pass


class WebhookWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Webhook
        fields = ["name", "url", "events", "secret", "enabled", "created_by"]

    def validate_events(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("events 必须是事件数组")
        return value


class WebhookDeliverySerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = WebhookDelivery
        fields = [
            "id", "webhook_id", "event", "payload", "status", "status_label",
            "response_code", "attempts", "error", "created_at",
        ]
