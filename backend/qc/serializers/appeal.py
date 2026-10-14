"""申诉序列化器(F11.7)。"""
from rest_framework import serializers

from ..models import Appeal


def _username(user) -> str:
    return user.username if user else ""


class AppealListSerializer(serializers.ModelSerializer):
    annotator = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Appeal
        fields = ["id", "annotator", "unit_id", "reason", "status", "status_label", "created_at"]

    def get_annotator(self, obj):
        return _username(obj.annotator)


class AppealDetailSerializer(AppealListSerializer):
    handled_by = serializers.SerializerMethodField()

    class Meta(AppealListSerializer.Meta):
        fields = AppealListSerializer.Meta.fields + ["handled_by", "resolution"]

    def get_handled_by(self, obj):
        return _username(obj.handled_by)


class AppealWriteSerializer(serializers.ModelSerializer):
    annotator = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Appeal
        fields = ["annotator", "unit", "reason", "status"]
