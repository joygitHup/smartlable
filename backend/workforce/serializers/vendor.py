"""供应商团队序列化器。"""
from rest_framework import serializers

from ..models import VendorTeam


class VendorTeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = VendorTeam
        fields = [
            "id",
            "name",
            "vendor",
            "isolation_key",
            "is_isolated",
            "contact",
            "capacity",
            "created_at",
            "updated_at",
        ]

    def validate_isolation_key(self, value):
        if not value.strip():
            raise serializers.ValidationError("隔离标识不能为空")
        return value
