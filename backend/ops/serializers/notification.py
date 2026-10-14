"""通知序列化器(F14.2)。"""
from rest_framework import serializers

from ..models import Notification


class NotificationListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "title", "content", "category", "is_read", "ref_type", "ref_id", "created_at"]


class NotificationDetailSerializer(NotificationListSerializer):
    class Meta(NotificationListSerializer.Meta):
        fields = NotificationListSerializer.Meta.fields
