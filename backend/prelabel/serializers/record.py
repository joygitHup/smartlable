"""预标注记录序列化器(F10.3/F10.5)。"""
from rest_framework import serializers

from ..models import PrelabelRecord


class PrelabelRecordListSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = PrelabelRecord
        fields = [
            "id",
            "unit_id",
            "task_id",
            "chosen_model",
            "status",
            "status_label",
            "fallback_reason",
            "created_at",
            "updated_at",
        ]


class PrelabelRecordDetailSerializer(PrelabelRecordListSerializer):
    class Meta(PrelabelRecordListSerializer.Meta):
        fields = PrelabelRecordListSerializer.Meta.fields + ["candidates", "explanation"]


class PrelabelRecordWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrelabelRecord
        fields = ["unit", "task", "candidates", "chosen_model", "explanation", "status", "fallback_reason"]
