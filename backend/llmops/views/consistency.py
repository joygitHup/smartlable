"""人机一致性视图(F15.4)：只读列表/创建 + 对比。"""
from rest_framework import mixins, viewsets
from rest_framework.decorators import action

from common.constants import ErrorCode
from common.response import ok
from tasks.models import Task

from ..constants import LLMOPS_ERROR_MESSAGE, LlmopsErrorCode
from ..filters import filter_consistency
from ..models import ConsistencyReport
from ..pagination import LlmopsPagination
from ..permissions import LlmopsManagePermission, LlmopsReadPermission
from ..serializers import (
    ConsistencyReportDetailSerializer,
    ConsistencyReportListSerializer,
    ConsistencyReportWriteSerializer,
)
from ..services import consistency_service
from ..utils import business_error
from .base import EnvelopeViewSetMixin


class ConsistencyReportViewSet(
    EnvelopeViewSetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = ConsistencyReport.objects.select_related("task")
    pagination_class = LlmopsPagination

    def get_queryset(self):
        return filter_consistency(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return ConsistencyReportListSerializer
        if self.action == "create":
            return ConsistencyReportWriteSerializer
        return ConsistencyReportDetailSerializer

    def get_permissions(self):
        if self.action == "list":
            return [LlmopsReadPermission()]
        return [LlmopsManagePermission()]

    @action(detail=False, methods=["post"], url_path="compare")
    def compare(self, request):
        task_id = request.data.get("task") or request.data.get("task_id")
        if not task_id:
            raise business_error(LlmopsErrorCode.TASK_REQUIRED, status_code=400)
        try:
            task = Task.objects.get(id=task_id)
        except Task.DoesNotExist:
            raise business_error(ErrorCode.NOT_FOUND, LLMOPS_ERROR_MESSAGE[LlmopsErrorCode.TASK_NOT_FOUND],
                                 status_code=404)
        report = consistency_service.compare(task, model=request.data.get("model", ""), user=request.user)
        return ok(ConsistencyReportDetailSerializer(report).data)
