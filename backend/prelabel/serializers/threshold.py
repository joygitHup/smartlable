"""类别阈值序列化器(F10.1)。"""
from rest_framework import serializers

from ..models import ClassThreshold


def _username(user) -> str:
    return user.username if user else ""


class ClassThresholdListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = ClassThreshold
        fields = [
            "id",
            "task_id",
            "task_type",
            "label",
            "threshold",
            "auto_tuned",
            "human_correction_rate",
            "sample_size",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class ClassThresholdDetailSerializer(ClassThresholdListSerializer):
    pass


class ClassThresholdWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = ClassThreshold
        fields = [
            "task",
            "task_type",
            "label",
            "threshold",
            "auto_tuned",
            "human_correction_rate",
            "sample_size",
            "created_by",
        ]

    def validate_threshold(self, value):
        if not 0 <= value <= 1:
            raise serializers.ValidationError("threshold 必须在 0~1 之间")
        return value
