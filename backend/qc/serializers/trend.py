"""质量趋势序列化器(F11.5)。"""
from rest_framework import serializers

from ..models import QualityTrend


def _username(user) -> str:
    return user.username if user else ""


class QualityTrendSerializer(serializers.ModelSerializer):
    annotator = serializers.SerializerMethodField()

    class Meta:
        model = QualityTrend
        fields = ["id", "annotator", "task_id", "date", "accuracy", "sample_size", "created_at"]

    def get_annotator(self, obj):
        return _username(obj.annotator)
