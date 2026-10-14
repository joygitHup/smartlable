"""开放 API 客户端序列化器(F13.1)。"""
from rest_framework import serializers

from ..models import APIClient


def _username(user) -> str:
    return user.username if user else ""


class APIClientListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = APIClient
        fields = ["id", "name", "key", "scopes", "enabled", "last_used_at", "created_by", "created_at", "updated_at"]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class APIClientDetailSerializer(APIClientListSerializer):
    class Meta(APIClientListSerializer.Meta):
        fields = APIClientListSerializer.Meta.fields + ["secret"]


class APIClientWriteSerializer(serializers.ModelSerializer):
    # key/secret 由服务端生成，仅只读展示
    key = serializers.CharField(read_only=True)
    secret = serializers.CharField(read_only=True)
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = APIClient
        fields = ["name", "scopes", "enabled", "key", "secret", "created_by"]

    def validate_scopes(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("scopes 必须是字符串数组")
        return value
