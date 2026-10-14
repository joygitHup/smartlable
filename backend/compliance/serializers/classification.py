"""数据分级分类与分级策略序列化器(F12.1)。"""
from rest_framework import serializers

from ..models import DataClassPolicy, DataClassification


def _username(user) -> str:
    return user.username if user else ""


class DataClassificationListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    level_label = serializers.CharField(source="get_level_display", read_only=True)

    class Meta:
        model = DataClassification
        fields = ["id", "name", "level", "level_label", "description", "created_by", "created_at", "updated_at"]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class DataClassificationDetailSerializer(DataClassificationListSerializer):
    pass


class DataClassificationWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = DataClassification
        fields = ["name", "level", "description", "created_by"]

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("分类名称不能为空")
        return value


class DataClassPolicyListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    level_label = serializers.CharField(source="get_level_display", read_only=True)

    class Meta:
        model = DataClassPolicy
        fields = [
            "id", "task_type", "level", "level_label", "allowed_roles", "require_secure_env",
            "created_by", "created_at", "updated_at",
        ]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class DataClassPolicyDetailSerializer(DataClassPolicyListSerializer):
    pass


class DataClassPolicyWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = DataClassPolicy
        fields = ["task_type", "level", "allowed_roles", "require_secure_env", "created_by"]

    def validate_allowed_roles(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("allowed_roles 必须是角色数组")
        return value
