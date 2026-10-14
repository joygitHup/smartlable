"""训练平台视图(F13.4)：CRUD + 结果推送。"""
from rest_framework import viewsets
from rest_framework.decorators import action

from common.constants import ErrorCode
from common.response import ok
from tasks.models import Task

from ..constants import IntegrationErrorCode
from ..filters import filter_platforms
from ..models import TrainingPlatform
from ..pagination import IntegrationPagination
from ..permissions import IntegrationManagePermission, IntegrationReadPermission
from ..serializers import (
    PushRecordSerializer,
    TrainingPlatformDetailSerializer,
    TrainingPlatformListSerializer,
    TrainingPlatformWriteSerializer,
)
from ..services import platform_service
from ..utils import business_error, to_int
from .base import CreatorPreserveMixin, EnvelopeViewSetMixin


class TrainingPlatformViewSet(CreatorPreserveMixin, EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = TrainingPlatform.objects.select_related("created_by")
    pagination_class = IntegrationPagination

    def get_queryset(self):
        return filter_platforms(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return TrainingPlatformListSerializer
        if self.action == "retrieve":
            return TrainingPlatformDetailSerializer
        return TrainingPlatformWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IntegrationReadPermission()]
        return [IntegrationManagePermission()]

    @action(detail=True, methods=["post"], url_path="push")
    def push(self, request, pk=None):
        task_id = to_int(request.data.get("task") or request.data.get("task_id"), None)
        if not task_id:
            raise business_error(IntegrationErrorCode.TASK_REQUIRED, status_code=400)
        try:
            task = Task.objects.get(id=task_id)
        except Task.DoesNotExist:
            raise business_error(ErrorCode.NOT_FOUND, "任务不存在", status_code=404)
        record = platform_service.push_results(self.get_object(), task, request.user)
        return ok(PushRecordSerializer(record).data)
