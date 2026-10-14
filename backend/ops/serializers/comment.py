"""评论序列化器(F14.1)。"""
from rest_framework import serializers

from ..models import Comment


def _username(user) -> str:
    return user.username if user else ""


class CommentListSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ["id", "task_id", "unit_id", "author", "content", "parent_id", "mentions", "created_at"]

    def get_author(self, obj):
        return _username(obj.author)


class CommentDetailSerializer(CommentListSerializer):
    replies = serializers.SerializerMethodField()

    class Meta(CommentListSerializer.Meta):
        fields = CommentListSerializer.Meta.fields + ["replies"]

    def get_replies(self, obj):
        return CommentListSerializer(obj.replies.all(), many=True).data


class CommentWriteSerializer(serializers.ModelSerializer):
    author = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Comment
        fields = ["task", "unit", "author", "content", "parent", "mentions"]

    def validate_content(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("评论内容不能为空")
        return value
