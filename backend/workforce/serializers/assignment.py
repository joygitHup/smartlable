"""分配记录与分配结果序列化器。"""
from rest_framework import serializers

from ..models import Assignment


def _username(user) -> str:
    return user.username if user else ""


class AssignmentSerializer(serializers.ModelSerializer):
    assignee = serializers.SerializerMethodField()
    assigned_by = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    task_name = serializers.CharField(source="task.name", read_only=True)

    class Meta:
        model = Assignment
        fields = [
            "id",
            "task_id",
            "task_name",
            "unit_id",
            "assignee",
            "assigned_by",
            "status",
            "status_label",
            "matched_skills",
            "score",
            "created_at",
        ]

    def get_assignee(self, obj):
        return _username(obj.assignee)

    def get_assigned_by(self, obj):
        return _username(obj.assigned_by)


class AssignResultSerializer(serializers.Serializer):
    """分配动作返回体：命中的分配记录摘要。"""

    assignment_id = serializers.IntegerField()
    assignee = serializers.CharField()
    matched_skills = serializers.ListField(child=serializers.CharField())
    load = serializers.IntegerField()
    score = serializers.FloatField()
