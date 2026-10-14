"""返工任务序列化器(F11.6)。"""
from rest_framework import serializers

from ..models import ReworkTask


def _username(user) -> str:
    return user.username if user else ""


class ReworkTaskListSerializer(serializers.ModelSerializer):
    assigned_to = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ReworkTask
        fields = [
            "id",
            "task_id",
            "unit_id",
            "reason",
            "status",
            "status_label",
            "assigned_to",
            "source",
            "created_at",
        ]

    def get_assigned_to(self, obj):
        return _username(obj.assigned_to)


class ReworkTaskDetailSerializer(ReworkTaskListSerializer):
    pass


class ReworkTaskWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReworkTask
        fields = ["task", "unit", "reason", "status", "assigned_to", "source"]

    def validate(self, attrs):
        task = attrs.get("task")
        unit = attrs.get("unit")
        if task and unit and unit.task_id != task.id:
            raise serializers.ValidationError("样本不属于所选的标注任务")
        return attrs
