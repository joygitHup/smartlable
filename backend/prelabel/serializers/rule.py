"""预标注规则序列化器(F10.6)。"""
from rest_framework import serializers

from ..models import PrelabelRule


def _username(user) -> str:
    return user.username if user else ""


class PrelabelRuleListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    rule_type_label = serializers.CharField(source="get_rule_type_display", read_only=True)

    class Meta:
        model = PrelabelRule
        fields = [
            "id",
            "task_type",
            "name",
            "rule_type",
            "rule_type_label",
            "pattern",
            "label",
            "priority",
            "enabled",
            "created_by",
            "created_at",
        ]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class PrelabelRuleDetailSerializer(PrelabelRuleListSerializer):
    pass


class PrelabelRuleWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = PrelabelRule
        fields = ["task_type", "name", "rule_type", "pattern", "label", "priority", "enabled", "created_by"]

    def validate(self, attrs):
        rule_type = attrs.get("rule_type") or getattr(self.instance, "rule_type", "keyword")
        pattern = attrs.get("pattern")
        if rule_type == "regex" and pattern:
            import re

            try:
                re.compile(pattern)
            except re.error as exc:
                raise serializers.ValidationError({"pattern": f"非法正则表达式：{exc}"})
        return attrs
