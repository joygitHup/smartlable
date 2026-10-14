"""计薪方案与班次序列化器。"""
from rest_framework import serializers

from ..models import PayScheme, Shift


def _username(user) -> str:
    return user.username if user else ""


class PaySchemeSerializer(serializers.ModelSerializer):
    mode_label = serializers.CharField(source="get_mode_display", read_only=True)

    class Meta:
        model = PayScheme
        fields = ["id", "name", "mode", "mode_label", "rate", "currency", "task_type", "description", "created_at"]

    def validate_rate(self, value):
        if value < 0:
            raise serializers.ValidationError("单价不能为负数")
        return value


class ShiftSerializer(serializers.ModelSerializer):
    assignee = serializers.SerializerMethodField()

    class Meta:
        model = Shift
        fields = ["id", "name", "assignee", "start_at", "end_at", "capacity", "note", "created_at"]

    def get_assignee(self, obj):
        return _username(obj.assignee)

    def validate(self, attrs):
        start = attrs.get("start_at")
        end = attrs.get("end_at")
        if start and end and end <= start:
            raise serializers.ValidationError("班次结束时间必须晚于开始时间")
        return attrs
