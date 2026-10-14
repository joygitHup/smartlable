"""争议样本与裁决序列化器。"""
from rest_framework import serializers

from ..models import Arbitration, DisputeSample


def _username(user) -> str:
    return user.username if user else ""


class DisputeSampleListSerializer(serializers.ModelSerializer):
    raised_by = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = DisputeSample
        fields = ["id", "task_id", "unit_id", "raised_by", "reason", "status", "status_label", "created_at"]

    def get_raised_by(self, obj):
        return _username(obj.raised_by)


class ArbitrationSerializer(serializers.ModelSerializer):
    arbiter = serializers.SerializerMethodField()

    class Meta:
        model = Arbitration
        fields = ["id", "decision", "label", "note", "arbiter", "created_at"]

    def get_arbiter(self, obj):
        return _username(obj.arbiter)


class DisputeSampleDetailSerializer(DisputeSampleListSerializer):
    claimed_by = serializers.SerializerMethodField()
    arbitration = ArbitrationSerializer(read_only=True)

    class Meta(DisputeSampleListSerializer.Meta):
        fields = DisputeSampleListSerializer.Meta.fields + ["claimed_by", "arbitration"]

    def get_claimed_by(self, obj):
        return _username(obj.claimed_by)


class DisputeSampleWriteSerializer(serializers.ModelSerializer):
    raised_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = DisputeSample
        fields = ["task", "unit", "reason", "raised_by"]

    def validate(self, attrs):
        task = attrs.get("task")
        unit = attrs.get("unit")
        if task and unit and unit.task_id != task.id:
            raise serializers.ValidationError("样本不属于所选的标注任务")
        return attrs
