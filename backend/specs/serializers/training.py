"""培训题与作答序列化器。"""
from rest_framework import serializers

from ..models import TrainingAttempt, TrainingSet


def _username(user) -> str:
    return user.username if user else ""


class TrainingSetSerializer(serializers.ModelSerializer):
    task_type_label = serializers.CharField(source="get_task_type_display", read_only=True)
    difficulty_label = serializers.CharField(source="get_difficulty_display", read_only=True)

    class Meta:
        model = TrainingSet
        fields = [
            "id",
            "title",
            "task_type",
            "task_type_label",
            "question",
            "options",
            "answer",
            "difficulty",
            "difficulty_label",
            "reference",
            "created_at",
        ]


class TrainingAttemptSerializer(serializers.ModelSerializer):
    trainee = serializers.SerializerMethodField()

    class Meta:
        model = TrainingAttempt
        fields = ["id", "quiz_id", "trainee", "answer", "passed", "score", "created_at"]

    def get_trainee(self, obj):
        return _username(obj.trainee)


class TrainingAttemptWriteSerializer(serializers.Serializer):
    quiz = serializers.IntegerField()
    answer = serializers.JSONField(required=False, allow_null=True)
    trainee = serializers.HiddenField(default=serializers.CurrentUserDefault())
