"""LLM 成本序列化器(F15.2)。"""
from rest_framework import serializers

from ..models import LLMCostRecord


class LLMCostRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = LLMCostRecord
        fields = ["id", "task_id", "unit_id", "model", "prompt_tokens", "completion_tokens",
                  "total_tokens", "cost", "created_at"]


class LLMCostRecordWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = LLMCostRecord
        fields = ["task", "unit", "model", "prompt_tokens", "completion_tokens", "total_tokens", "cost"]

    def validate_model(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("模型标识不能为空")
        return value
