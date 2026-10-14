"""合规检查清单与结果序列化器(F12.6)。"""
from rest_framework import serializers

from ..models import ComplianceCheckResult, ComplianceChecklist


def _username(user) -> str:
    return user.username if user else ""


class ComplianceChecklistListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    framework_label = serializers.CharField(source="get_framework_display", read_only=True)

    class Meta:
        model = ComplianceChecklist
        fields = [
            "id", "framework", "framework_label", "item", "description", "required",
            "created_by", "created_at", "updated_at",
        ]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class ComplianceChecklistDetailSerializer(ComplianceChecklistListSerializer):
    pass


class ComplianceChecklistWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = ComplianceChecklist
        fields = ["framework", "item", "description", "required", "created_by"]

    def validate_item(self, value):
        if not value.strip():
            raise serializers.ValidationError("检查项不能为空")
        return value


class ComplianceCheckResultListSerializer(serializers.ModelSerializer):
    checked_by = serializers.SerializerMethodField()
    item = serializers.CharField(source="checklist.item", read_only=True)
    framework = serializers.CharField(source="checklist.framework", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ComplianceCheckResult
        fields = [
            "id", "checklist_id", "item", "framework", "status", "status_label",
            "checked_by", "note", "created_at", "updated_at",
        ]

    def get_checked_by(self, obj):
        return _username(obj.checked_by)


class ComplianceCheckResultDetailSerializer(ComplianceCheckResultListSerializer):
    pass


class ComplianceCheckResultWriteSerializer(serializers.ModelSerializer):
    checked_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = ComplianceCheckResult
        fields = ["checklist", "status", "checked_by", "note"]
