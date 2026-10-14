"""规范文档与版本序列化器。"""
from rest_framework import serializers

from ..models import SpecDocument, SpecVersion


def _username(user) -> str:
    return user.username if user else ""


class SpecVersionSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = SpecVersion
        fields = ["id", "version", "content", "change_note", "status", "created_by", "created_at"]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class SpecVersionWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = SpecVersion
        fields = ["version", "content", "change_note", "created_by"]


class SpecDocumentListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    task_type_label = serializers.CharField(source="get_task_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = SpecDocument
        fields = [
            "id",
            "title",
            "task_type",
            "task_type_label",
            "content",
            "status",
            "status_label",
            "current_version",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class SpecDocumentDetailSerializer(SpecDocumentListSerializer):
    task_id = serializers.IntegerField(source="task_id", read_only=True)
    versions = SpecVersionSerializer(many=True, read_only=True)

    class Meta(SpecDocumentListSerializer.Meta):
        fields = SpecDocumentListSerializer.Meta.fields + ["task_id", "versions"]


class SpecDocumentWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = SpecDocument
        fields = ["title", "task_type", "task", "content", "status", "created_by"]

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError("规范标题不能为空")
        return value
