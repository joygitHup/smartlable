"""幻觉检测序列化器(F15.3)。"""
from rest_framework import serializers

from ..models import HallucinationCheck


class HallucinationCheckListSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = HallucinationCheck
        fields = ["id", "unit_id", "model", "is_hallucination", "score", "status", "status_label", "created_at"]


class HallucinationCheckDetailSerializer(HallucinationCheckListSerializer):
    class Meta(HallucinationCheckListSerializer.Meta):
        fields = HallucinationCheckListSerializer.Meta.fields + ["reasons"]
