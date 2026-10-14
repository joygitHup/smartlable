"""安全环境视图(F12.3)：CRUD。"""
from rest_framework import viewsets

from ..filters import filter_environments
from ..models import SecureEnvironment
from ..pagination import CompliancePagination
from ..permissions import ComplianceManagePermission, ComplianceReadPermission
from ..serializers import (
    SecureEnvironmentDetailSerializer,
    SecureEnvironmentListSerializer,
    SecureEnvironmentWriteSerializer,
)
from .base import CreatorPreserveMixin, EnvelopeViewSetMixin


class SecureEnvironmentViewSet(CreatorPreserveMixin, EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = SecureEnvironment.objects.select_related("created_by")
    pagination_class = CompliancePagination

    def get_queryset(self):
        return filter_environments(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return SecureEnvironmentListSerializer
        if self.action == "retrieve":
            return SecureEnvironmentDetailSerializer
        return SecureEnvironmentWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [ComplianceReadPermission()]
        return [ComplianceManagePermission()]
