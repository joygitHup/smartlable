"""类别阈值视图(F10.1/F10.2)：CRUD + 动态调优。"""
from rest_framework import viewsets
from rest_framework.decorators import action

from common.constants import ErrorCode
from common.response import ok
from tasks.models import Task

from ..constants import PRELABEL_ERROR_MESSAGE, PrelabelErrorCode
from ..filters import filter_class_thresholds
from ..models import ClassThreshold
from ..pagination import PrelabelPagination
from ..permissions import PrelabelManagePermission, PrelabelReadPermission, PrelabelTunePermission
from ..serializers import (
    ClassThresholdDetailSerializer,
    ClassThresholdListSerializer,
    ClassThresholdWriteSerializer,
)
from ..services import threshold_service
from ..utils import business_error
from .base import EnvelopeViewSetMixin


class ClassThresholdViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = ClassThreshold.objects.select_related("created_by", "task")
    pagination_class = PrelabelPagination

    def get_queryset(self):
        return filter_class_thresholds(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return ClassThresholdListSerializer
        if self.action == "retrieve":
            return ClassThresholdDetailSerializer
        return ClassThresholdWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [PrelabelReadPermission()]
        if self.action == "tune":
            return [PrelabelTunePermission()]
        return [PrelabelManagePermission()]

    @action(detail=False, methods=["post"], url_path="tune")
    def tune(self, request):
        """按任务/任务类型基于人工修正率给出建议阈值(F10.2)。"""
        task_id = request.data.get("task") or request.data.get("task_id")
        task_type = request.data.get("task_type")
        task = None
        if task_id:
            try:
                task = Task.objects.get(id=task_id)
            except Task.DoesNotExist:
                raise business_error(ErrorCode.NOT_FOUND, "任务不存在", status_code=404)
        if not task and not task_type:
            raise business_error(PrelabelErrorCode.TASK_TYPE_REQUIRED, status_code=400)
        write_back = request.data.get("write_back", True)
        result = threshold_service.tune_thresholds(task=task, task_type=task_type, user=request.user,
                                                   write_back=bool(write_back))
        return ok(result)
