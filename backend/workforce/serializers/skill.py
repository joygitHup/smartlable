"""技能标签序列化器。"""
from rest_framework import serializers

from ..models import SkillTag


class SkillTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillTag
        fields = ["id", "name", "category", "task_type", "created_at", "updated_at"]

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("技能名称不能为空")
        return value
