"""任务队列视图(F9.1)。"""
from rest_framework import mixins, viewsets
from rest_framework.decorators import action

from common.response import ok

from ..filters import filter_queue_entries
from ..models import TaskQueueEntry
from ..pagination import WorkforcePagination
from ..permissions import WorkforceManagePermission, WorkforceReadPermission
from ..serializers import TaskQueueEntrySerializer, TaskQueueEntryWriteSerializer
from ..services import queue_service
from ..utils import priority_rank_annotation, to_int
from .base import EnvelopeViewSetMixin


class TaskQueueEntryViewSet(
    EnvelopeViewSetMixin, mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    queryset = TaskQueueEntry.objects.select_related("task", "created_by")
    pagination_class = WorkforcePagination

    def get_queryset(self):
        qs = filter_queue_entries(self.queryset, self.request.query_params)
        return qs.annotate(_rank=priority_rank_annotation()).order_by("_rank", "order", "-created_at")

    def get_serializer_class(self):
        if self.action == "create":
            return TaskQueueEntryWriteSerializer
        return TaskQueueEntrySerializer

    def get_permissions(self):
        if self.action in ("create", "reprioritize"):
            return [WorkforceManagePermission()]
        return [WorkforceReadPermission()]

    @action(detail=True, methods=["post"], url_path="reprioritize")
    def reprioritize(self, request, pk=None):
        entry = self.get_object()
        entry = queue_service.reprioritize(
            entry, request.data.get("priority"), to_int(request.data.get("order"), None), request.user
        )
        return ok(TaskQueueEntrySerializer(entry).data)
