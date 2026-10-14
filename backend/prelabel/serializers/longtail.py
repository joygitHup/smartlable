"""长尾类别策略序列化器(F10.8)。"""
from rest_framework import serializers

from ..models import LongTailPolicy


def _username(user) -> str:
    return user.username if user else ""


class LongTailPolicyListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    strategy_label = serializers.CharField(source="get_strategy_display", read_only=True)

    class Meta:
        model = LongTailPolicy
        fields = [
            "id",
            "task_type",
            "label",
            "strategy",
            "strategy_label",
            "min_confidence",
            "notes",
            "created_by",
            "created_at",
        ]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class LongTailPolicyDetailSerializer(LongTailPolicyListSerializer):
    pass


class LongTailPolicyWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = LongTailPolicy
        fields = ["task_type", "label", "strategy", "min_confidence", "notes", "created_by"]

    def validate_min_confidence(self, value):
        if not 0 <= value <= 1:
            raise serializers.ValidationError("min_confidence 必须在 0~1 之间")
        return value
