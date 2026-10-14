"""操作全审计视图(F12.4)：复用 core.AuditLog 只读查询。"""
from rest_framework import viewsets

from core.models import AuditLog

from ..filters import filter_audit_logs
from ..pagination import CompliancePagination
from ..permissions import ComplianceReadPermission
from ..serializers import AuditLogSerializer
from .base import EnvelopeViewSetMixin


class AuditLogViewSet(EnvelopeViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("user")
    serializer_class = AuditLogSerializer
    pagination_class = CompliancePagination

    def get_queryset(self):
        return filter_audit_logs(super().get_queryset(), self.request.query_params)

    def get_permissions(self):
        return [ComplianceReadPermission()]
