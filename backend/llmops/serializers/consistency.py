"""人机一致性序列化器(F15.4)。"""
from rest_framework import serializers

from ..models import ConsistencyReport


class ConsistencyReportListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsistencyReport
        fields = ["id", "task_id", "model", "agreement_rate", "sample_size", "created_at"]


class ConsistencyReportDetailSerializer(ConsistencyReportListSerializer):
    class Meta(ConsistencyReportListSerializer.Meta):
        fields = ConsistencyReportListSerializer.Meta.fields + ["details"]


class ConsistencyReportWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsistencyReport
        fields = ["task", "model", "agreement_rate", "sample_size", "details"]
