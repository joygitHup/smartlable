"""运营报表序列化器(F14.4)。"""
from rest_framework import serializers

from ..models import Report, ReportType


def _username(user) -> str:
    return user.username if user else ""


class ReportListSerializer(serializers.ModelSerializer):
    report_type_label = serializers.CharField(source="get_report_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    generated_by = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            "id", "report_type", "report_type_label", "period_start", "period_end",
            "status", "status_label", "generated_by", "created_at",
        ]

    def get_generated_by(self, obj):
        return _username(obj.generated_by)


class ReportDetailSerializer(ReportListSerializer):
    class Meta(ReportListSerializer.Meta):
        fields = ReportListSerializer.Meta.fields + ["metrics"]


class ReportWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ["report_type", "period_start", "period_end", "metrics", "status"]


class ReportGenerateSerializer(serializers.Serializer):
    """生成报表入参：类型 + 可选周期。"""

    report_type = serializers.ChoiceField(choices=ReportType.choices, default=ReportType.DAILY)
    period_start = serializers.DateField(required=False)
    period_end = serializers.DateField(required=False)
