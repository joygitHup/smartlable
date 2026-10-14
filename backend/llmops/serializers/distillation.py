"""蒸馏作业序列化器(F15.5)。"""
from rest_framework import serializers

from ..models import DistillationJob


class DistillationJobListSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = DistillationJob
        fields = ["id", "name", "teacher_model", "student_model", "task_type", "dataset_size",
                  "status", "status_label", "created_at"]


class DistillationJobDetailSerializer(DistillationJobListSerializer):
    class Meta(DistillationJobListSerializer.Meta):
        fields = DistillationJobListSerializer.Meta.fields + ["metrics", "notes"]


class DistillationJobWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DistillationJob
        fields = ["name", "teacher_model", "student_model", "task_type", "dataset_size", "notes"]

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("作业名称不能为空")
        return value
