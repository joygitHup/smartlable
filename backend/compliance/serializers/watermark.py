"""水印与溯源序列化器(F12.2)。"""
from rest_framework import serializers

from ..models import Watermark


def _username(user) -> str:
    return user.username if user else ""


class WatermarkSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = Watermark
        fields = [
            "id", "target_type", "target_id", "text", "token", "hash",
            "created_by", "created_at",
        ]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class WatermarkGenerateSerializer(serializers.Serializer):
    """水印生成入参（非模型写入，仅校验）。"""

    target_type = serializers.CharField(max_length=64)
    target_id = serializers.CharField(max_length=64)
    text = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")

    def validate_target_type(self, value):
        if not value.strip():
            raise serializers.ValidationError("target_type 不能为空")
        return value
