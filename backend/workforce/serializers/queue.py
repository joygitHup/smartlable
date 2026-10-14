"""任务队列序列化器。"""
from rest_framework import serializers

from ..models import TaskQueueEntry
from tasks.models import Priority


def _username(user) -> str:
    return user.username if user else ""


class TaskQueueEntrySerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    task_name = serializers.CharField(source="task.name", read_only=True)

    class Meta:
        model = TaskQueueEntry
        fields = [
            "id",
            "task_id",
            "task_name",
            "priority",
            "priority_label",
            "order",
            "status",
            "status_label",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class TaskQueueEntryWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())
    priority = serializers.ChoiceField(choices=Priority.choices, required=False)

    class Meta:
        model = TaskQueueEntry
        fields = ["task", "priority", "order", "status", "created_by"]
