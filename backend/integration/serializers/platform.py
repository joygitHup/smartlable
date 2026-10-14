"""训练平台与推送记录序列化器(F13.4)。"""
from rest_framework import serializers

from ..models import PushRecord, TrainingPlatform


def _username(user) -> str:
    return user.username if user else ""


class TrainingPlatformListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = TrainingPlatform
        fields = ["id", "name", "platform_type", "endpoint", "config", "enabled", "created_by", "created_at", "updated_at"]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class TrainingPlatformDetailSerializer(TrainingPlatformListSerializer):
    pass


class TrainingPlatformWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = TrainingPlatform
        fields = ["name", "platform_type", "endpoint", "config", "enabled", "created_by"]

    def validate_config(self, value):
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("config 必须是对象")
        return value


class PushRecordSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = PushRecord
        fields = [
            "id", "platform_id", "task_id", "status", "status_label",
            "payload", "response", "created_by", "created_at",
        ]

    def get_created_by(self, obj):
        return _username(obj.created_by)
