"""审计日志序列化器(F12.4，复用 core.AuditLog)。"""
from rest_framework import serializers

from core.models import AuditLog


def _username(user) -> str:
    return user.username if user else ""


class AuditLogSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = ["id", "user", "action", "target_type", "target_id", "detail", "ip", "created_at"]

    def get_user(self, obj):
        return _username(obj.user)
