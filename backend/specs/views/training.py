"""培训题与作答视图。"""
from rest_framework import mixins, viewsets

from common.constants import ErrorCode
from common.response import ok

from ..filters import filter_quizzes
from ..models import TrainingAttempt, TrainingSet
from ..pagination import SpecsPagination
from ..serializers import (
    TrainingAttemptSerializer,
    TrainingAttemptWriteSerializer,
    TrainingSetSerializer,
)
from ..services import training_service
from ..utils import business_error
from .base import EnvelopeViewSetMixin


class TrainingSetViewSet(
    EnvelopeViewSetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = TrainingSet.objects.select_related("created_by")
    serializer_class = TrainingSetSerializer
    pagination_class = SpecsPagination

    def get_queryset(self):
        qs = super().get_queryset()
        return filter_quizzes(qs, self.request.query_params)


class TrainingAttemptViewSet(EnvelopeViewSetMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = TrainingAttempt.objects.select_related("quiz", "trainee")
    serializer_class = TrainingAttemptSerializer
    pagination_class = SpecsPagination

    def create(self, request, *args, **kwargs):
        write = TrainingAttemptWriteSerializer(data=request.data, context=self.get_serializer_context())
        write.is_valid(raise_exception=True)
        quiz_id = write.validated_data["quiz"]
        try:
            quiz = TrainingSet.objects.get(id=quiz_id)
        except TrainingSet.DoesNotExist:
            raise business_error(ErrorCode.NOT_FOUND, "培训题不存在", status_code=404)
        attempt = training_service.submit_attempt(
            quiz, request.user, write.validated_data.get("answer")
        )
        data = TrainingAttemptSerializer(attempt).data
        data["passed"] = attempt.passed
        return ok(data, message="通过" if attempt.passed else "未通过")
