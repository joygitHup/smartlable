"""多轮标注序列化器(F15.6)。"""
from rest_framework import serializers

from ..models import MultiRoundSession, RoundRecord


def _username(user) -> str:
    return user.username if user else ""


class RoundRecordSerializer(serializers.ModelSerializer):
    annotator = serializers.SerializerMethodField()

    class Meta:
        model = RoundRecord
        fields = ["id", "session_id", "round_no", "label", "annotator", "notes", "created_at"]

    def get_annotator(self, obj):
        return _username(obj.annotator)


class MultiRoundSessionListSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    round_count = serializers.IntegerField(source="_round_count", read_only=True)

    class Meta:
        model = MultiRoundSession
        fields = ["id", "task_id", "unit_id", "current_round", "max_round", "status", "status_label",
                  "round_count", "created_at"]


class MultiRoundSessionDetailSerializer(MultiRoundSessionListSerializer):
    rounds = RoundRecordSerializer(many=True, read_only=True)

    class Meta(MultiRoundSessionListSerializer.Meta):
        fields = MultiRoundSessionListSerializer.Meta.fields + ["rounds"]


class MultiRoundSessionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MultiRoundSession
        fields = ["task", "unit", "current_round", "max_round", "status"]

    def validate_max_round(self, value):
        if value < 1:
            raise serializers.ValidationError("max_round 至少为 1")
        return value
