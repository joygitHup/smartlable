"""工时预估序列化器。"""
from rest_framework import serializers

from ..models import WorkEstimate


def _username(user) -> str:
    return user.username if user else ""


class WorkEstimateSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    task_name = serializers.CharField(source="task.name", read_only=True)

    class Meta:
        model = WorkEstimate
        fields = [
            "id",
            "task_id",
            "task_name",
            "estimated_minutes",
            "method",
            "sample_size",
            "basis",
            "created_by",
            "created_at",
        ]

    def get_created_by(self, obj):
        return _username(obj.created_by)
