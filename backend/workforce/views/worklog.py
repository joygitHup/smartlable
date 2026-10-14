"""工时记录视图。"""
from rest_framework import mixins, viewsets

from ..filters import filter_worklogs
from ..models import Worklog
from ..pagination import WorkforcePagination
from ..permissions import WorkforceManagePermission, WorkforceReadPermission
from ..serializers import WorklogSerializer, WorklogWriteSerializer
from .base import EnvelopeViewSetMixin


class WorklogViewSet(EnvelopeViewSetMixin, mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = Worklog.objects.select_related("assignee", "task", "assignment")
    pagination_class = WorkforcePagination

    def get_queryset(self):
        return filter_worklogs(self.queryset, self.request.query_params)

    def get_serializer_class(self):
        if self.action == "create":
            return WorklogWriteSerializer
        return WorklogSerializer

    def get_permissions(self):
        if self.action == "create":
            return [WorkforceManagePermission()]
        return [WorkforceReadPermission()]
