"""金标样本与注入序列化器(F11.1)。"""
from rest_framework import serializers

from ..models import GoldInjection, GoldSample


def _username(user) -> str:
    return user.username if user else ""


class GoldSampleListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    task_name = serializers.CharField(source="task.name", read_only=True)

    class Meta:
        model = GoldSample
        fields = ["id", "task_id", "task_name", "content", "active", "created_by", "created_at"]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class GoldSampleDetailSerializer(GoldSampleListSerializer):
    class Meta(GoldSampleListSerializer.Meta):
        fields = GoldSampleListSerializer.Meta.fields + ["expected_label"]


class GoldSampleWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = GoldSample
        fields = ["task", "content", "expected_label", "active", "created_by"]

    def validate_content(self, value):
        if not value.strip():
            raise serializers.ValidationError("金标样本内容不能为空")
        return value


class GoldInjectionSerializer(serializers.ModelSerializer):
    assigned_to = serializers.SerializerMethodField()

    class Meta:
        model = GoldInjection
        fields = ["id", "task_id", "sample_id", "unit_id", "batch", "assigned_to", "injected_at", "created_at"]

    def get_assigned_to(self, obj):
        return _username(obj.assigned_to)
