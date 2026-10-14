"""安全环境序列化器(F12.3)。"""
from rest_framework import serializers

from ..models import SecureEnvironment


def _username(user) -> str:
    return user.username if user else ""


class SecureEnvironmentListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    level_label = serializers.CharField(source="get_level_display", read_only=True)

    class Meta:
        model = SecureEnvironment
        fields = [
            "id", "name", "level", "level_label", "allow_screenshot", "allow_copy",
            "require_approval", "enabled", "created_by", "created_at", "updated_at",
        ]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class SecureEnvironmentDetailSerializer(SecureEnvironmentListSerializer):
    pass


class SecureEnvironmentWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = SecureEnvironment
        fields = [
            "name", "level", "allow_screenshot", "allow_copy", "require_approval", "enabled", "created_by",
        ]

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("环境名称不能为空")
        return value
