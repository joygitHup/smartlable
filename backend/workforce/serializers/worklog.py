"""工时记录序列化器。"""
from rest_framework import serializers

from ..models import Worklog


def _username(user) -> str:
    return user.username if user else ""


class WorklogSerializer(serializers.ModelSerializer):
    assignee = serializers.SerializerMethodField()
    task_name = serializers.CharField(source="task.name", read_only=True, default="")

    class Meta:
        model = Worklog
        fields = [
            "id",
            "assignee",
            "task_id",
            "task_name",
            "assignment_id",
            "effective_minutes",
            "work_date",
            "note",
            "created_at",
        ]

    def get_assignee(self, obj):
        return _username(obj.assignee)


class WorklogWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Worklog
        fields = ["assignee", "task", "assignment", "effective_minutes", "work_date", "note"]

    def validate_effective_minutes(self, value):
        if value < 0:
            raise serializers.ValidationError("有效工时不能为负数")
        return value
