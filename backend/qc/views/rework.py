"""返工任务视图(F11.6)：CRUD + 完成返工。"""
from rest_framework import viewsets
from rest_framework.decorators import action

from common.response import ok

from ..filters import filter_reworks
from ..models import ReworkTask
from ..pagination import QcPagination
from ..permissions import QcManagePermission, QcReadPermission
from ..serializers import ReworkTaskDetailSerializer, ReworkTaskListSerializer, ReworkTaskWriteSerializer
from ..services import rework_service
from .base import EnvelopeViewSetMixin


class ReworkTaskViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = ReworkTask.objects.select_related("task", "unit", "assigned_to")
    pagination_class = QcPagination

    def get_queryset(self):
        return filter_reworks(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return ReworkTaskListSerializer
        if self.action == "retrieve":
            return ReworkTaskDetailSerializer
        return ReworkTaskWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [QcReadPermission()]
        return [QcManagePermission()]

    def perform_create(self, serializer):
        rework = serializer.save()
        # 指派给具体标注员时，通知其处理返工(F14.2)
        if rework.assigned_to_id:
            from ops.services import notification_service  # 延迟导入，避免应用间循环依赖

            notification_service.notify(
                recipients=rework.assigned_to,
                title=f"新返工任务：任务 #{rework.task_id}",
                content=f"样本 #{rework.unit_id} 需返工：{rework.reason or '（无说明）'}",
                category="rework",
                ref_type="rework",
                ref_id=rework.id,
            )

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        rework = rework_service.complete_rework(self.get_object(), request.user)
        return ok(ReworkTaskDetailSerializer(rework).data)
