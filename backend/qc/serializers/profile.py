"""标注员能力画像序列化器(F11.4)。"""
from rest_framework import serializers

from ..models import AnnotatorProfile


def _username(user) -> str:
    return user.username if user else ""


class AnnotatorProfileListSerializer(serializers.ModelSerializer):
    annotator = serializers.SerializerMethodField()

    class Meta:
        model = AnnotatorProfile
        fields = ["id", "annotator", "task_type", "accuracy", "total_reviewed", "created_at", "updated_at"]

    def get_annotator(self, obj):
        return _username(obj.annotator)


class AnnotatorProfileDetailSerializer(AnnotatorProfileListSerializer):
    class Meta(AnnotatorProfileListSerializer.Meta):
        fields = AnnotatorProfileListSerializer.Meta.fields + ["category_metrics"]
