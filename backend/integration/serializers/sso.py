"""SSO 配置序列化器(F13.5)。"""
from rest_framework import serializers

from ..models import SSOConfig


def _username(user) -> str:
    return user.username if user else ""


class SSOConfigListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    provider_label = serializers.CharField(source="get_provider_display", read_only=True)

    class Meta:
        model = SSOConfig
        fields = ["id", "name", "provider", "provider_label", "config", "enabled", "created_by", "created_at", "updated_at"]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class SSOConfigDetailSerializer(SSOConfigListSerializer):
    pass


class SSOConfigWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = SSOConfig
        fields = ["name", "provider", "config", "enabled", "created_by"]

    def validate_config(self, value):
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("config 必须是对象")
        return value
