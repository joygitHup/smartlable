"""交叉复核序列化器(F11.3)。"""
from rest_framework import serializers

from ..models import CrossReview


def _username(user) -> str:
    return user.username if user else ""


class CrossReviewListSerializer(serializers.ModelSerializer):
    reviewer_a = serializers.SerializerMethodField()
    reviewer_b = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = CrossReview
        fields = [
            "id",
            "unit_id",
            "reviewer_a",
            "reviewer_b",
            "agreed",
            "status",
            "status_label",
            "created_at",
        ]

    def get_reviewer_a(self, obj):
        return _username(obj.reviewer_a)

    def get_reviewer_b(self, obj):
        return _username(obj.reviewer_b)


class CrossReviewDetailSerializer(CrossReviewListSerializer):
    class Meta(CrossReviewListSerializer.Meta):
        fields = CrossReviewListSerializer.Meta.fields + ["label_a", "label_b"]


class CrossReviewWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrossReview
        fields = ["unit", "reviewer_a", "reviewer_b", "label_a", "label_b", "agreed", "status"]

    def validate(self, attrs):
        a = attrs.get("reviewer_a")
        b = attrs.get("reviewer_b")
        if a and b and a == b:
            raise serializers.ValidationError("复核人 A 与 B 不能为同一人")
        return attrs
