"""数据源序列化器(F13.3)。"""
from rest_framework import serializers

from ..models import DataSource


def _username(user) -> str:
    return user.username if user else ""


class DataSourceListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    source_type_label = serializers.CharField(source="get_source_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = DataSource
        fields = [
            "id", "name", "source_type", "source_type_label", "config", "enabled",
            "status", "status_label", "last_sync_at", "created_by", "created_at", "updated_at",
        ]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class DataSourceDetailSerializer(DataSourceListSerializer):
    pass


class DataSourceWriteSerializer(serializers.ModelSerializer):
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = DataSource
        fields = ["name", "source_type", "config", "enabled", "created_by"]

    def validate_config(self, value):
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("config 必须是对象")
        return value
