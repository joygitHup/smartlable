"""A/B 实验序列化器(F10.7)。"""
from rest_framework import serializers

from ..models import ABExperiment


def _username(user) -> str:
    return user.username if user else ""


class ABExperimentListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    task_name = serializers.CharField(source="task.name", read_only=True)

    class Meta:
        model = ABExperiment
        fields = [
            "id",
            "task_id",
            "task_name",
            "name",
            "model_a",
            "model_b",
            "status",
            "status_label",
            "split_ratio",
            "winner",
            "created_by",
            "created_at",
        ]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class ABExperimentDetailSerializer(ABExperimentListSerializer):
    class Meta(ABExperimentListSerializer.Meta):
        fields = ABExperimentListSerializer.Meta.fields + ["result_a", "result_b"]


class ABExperimentWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = ABExperiment
        fields = ["task", "name", "model_a", "model_b", "status", "split_ratio", "created_by"]

    def validate_split_ratio(self, value):
        if not 0 <= value <= 1:
            raise serializers.ValidationError("split_ratio 必须在 0~1 之间")
        return value
