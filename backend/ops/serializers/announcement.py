"""公告序列化器(F14.2)。"""
from rest_framework import serializers

from ..models import Announcement


def _username(user) -> str:
    return user.username if user else ""


class AnnouncementListSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    level_label = serializers.CharField(source="get_level_display", read_only=True)

    class Meta:
        model = Announcement
        fields = [
            "id", "title", "level", "level_label", "target_roles",
            "published", "published_at", "created_by", "created_at",
        ]

    def get_created_by(self, obj):
        return _username(obj.created_by)


class AnnouncementDetailSerializer(AnnouncementListSerializer):
    class Meta(AnnouncementListSerializer.Meta):
        fields = AnnouncementListSerializer.Meta.fields + ["content"]


class AnnouncementWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = ["title", "content", "level", "target_roles", "published"]

    def validate_title(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("公告标题不能为空")
        return value
