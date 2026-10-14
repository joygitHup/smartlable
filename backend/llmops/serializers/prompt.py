"""Prompt 模板与版本序列化器(F15.1)。"""
from rest_framework import serializers

from ..models import PromptTemplate, PromptVersion


def _username(user) -> str:
    return user.username if user else ""


class PromptVersionSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = PromptVersion
        fields = ["id", "template_id", "version", "content", "change_note", "status", "status_label",
                  "created_by", "created_at"]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class PromptVersionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PromptVersion
        fields = ["content", "change_note"]

    def validate_content(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Prompt 内容不能为空")
        return value


class PromptTemplateListSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    version_count = serializers.IntegerField(source="_version_count", read_only=True)

    class Meta:
        model = PromptTemplate
        fields = ["id", "name", "task_type", "description", "status", "status_label",
                  "current_version", "version_count", "created_at"]


class PromptTemplateDetailSerializer(PromptTemplateListSerializer):
    active_version = serializers.SerializerMethodField()

    class Meta(PromptTemplateListSerializer.Meta):
        fields = PromptTemplateListSerializer.Meta.fields + ["active_version"]

    def get_active_version(self, obj):
        # 基于 View 预加载的 versions 集合计算，避免额外查询
        if not obj.current_version:
            return None
        version = next((v for v in obj.versions.all() if v.version == obj.current_version), None)
        return PromptVersionSerializer(version).data if version else None


class PromptTemplateWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PromptTemplate
        fields = ["name", "task_type", "description", "status"]

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("模板名称不能为空")
        return value
