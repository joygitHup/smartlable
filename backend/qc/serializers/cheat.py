"""作弊检测序列化器(F11.2)。"""
from rest_framework import serializers

from ..models import CheatDetection


def _username(user) -> str:
    return user.username if user else ""


class CheatDetectionListSerializer(serializers.ModelSerializer):
    annotator = serializers.SerializerMethodField()
    pattern_type_label = serializers.CharField(source="get_pattern_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = CheatDetection
        fields = [
            "id",
            "task_id",
            "annotator",
            "pattern_type",
            "pattern_type_label",
            "score",
            "status",
            "status_label",
            "created_at",
        ]

    def get_annotator(self, obj):
        return _username(obj.annotator)


class CheatDetectionDetailSerializer(CheatDetectionListSerializer):
    class Meta(CheatDetectionListSerializer.Meta):
        fields = CheatDetectionListSerializer.Meta.fields + ["evidence"]
