"""反馈序列化器(F14.6)。"""
from rest_framework import serializers

from ..models import Feedback


def _username(user) -> str:
    return user.username if user else ""


class FeedbackListSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    handled_by = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Feedback
        fields = ["id", "user", "category", "content", "status", "status_label", "handled_by", "created_at"]

    def get_user(self, obj):
        return _username(obj.user)

    def get_handled_by(self, obj):
        return _username(obj.handled_by)


class FeedbackDetailSerializer(FeedbackListSerializer):
    class Meta(FeedbackListSerializer.Meta):
        fields = FeedbackListSerializer.Meta.fields + ["response"]


class FeedbackWriteSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Feedback
        fields = ["user", "category", "content"]

    def validate_content(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("反馈内容不能为空")
        return value
