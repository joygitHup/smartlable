"""计薪方案与班次视图(F9.5/F9.6)。"""
from rest_framework import viewsets

from ..models import PayScheme, Shift
from ..pagination import WorkforcePagination
from ..permissions import WorkforceManagePermission, WorkforceReadPermission
from ..serializers import PaySchemeSerializer, ShiftSerializer
from .base import EnvelopeViewSetMixin


class _ReadWritePermissionMixin:
    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [WorkforceReadPermission()]
        return [WorkforceManagePermission()]


class PaySchemeViewSet(_ReadWritePermissionMixin, EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = PayScheme.objects.all()
    serializer_class = PaySchemeSerializer
    pagination_class = WorkforcePagination


class ShiftViewSet(_ReadWritePermissionMixin, EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = Shift.objects.select_related("assignee")
    serializer_class = ShiftSerializer
    pagination_class = WorkforcePagination
