"""数据生命周期策略序列化器(F12.5)。"""
from rest_framework import serializers

from ..models import DataLifecyclePolicy


def _username(user) -> str:
    return user.username if user else ""


class DataLifecyclePolicyListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    level_label = serializers.CharField(source="get_level_display", read_only=True)
    action_label = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = DataLifecyclePolicy
        fields = [
            "id", "level", "level_label", "retention_days", "action", "action_label",
            "applies_to_task_type", "enabled", "created_by", "created_at", "updated_at",
        ]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class DataLifecyclePolicyDetailSerializer(DataLifecyclePolicyListSerializer):
    pass


class DataLifecyclePolicyWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = DataLifecyclePolicy
        fields = ["level", "retention_days", "action", "applies_to_task_type", "enabled", "created_by"]

    def validate_retention_days(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("retention_days 必须为正整数")
        return value
