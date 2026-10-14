"""数据生命周期视图(F12.5)：策略 CRUD + 生命周期执行。"""
from rest_framework import viewsets

from common.response import ok

from ..filters import filter_lifecycle_policies
from ..models import DataLifecyclePolicy
from ..pagination import CompliancePagination
from ..permissions import ComplianceManagePermission, ComplianceReadPermission, ComplianceSecurityPermission
from ..serializers import (
    DataLifecyclePolicyDetailSerializer,
    DataLifecyclePolicyListSerializer,
    DataLifecyclePolicyWriteSerializer,
)
from ..services import lifecycle_service
from .base import CreatorPreserveMixin, EnvelopeViewSetMixin


class DataLifecyclePolicyViewSet(CreatorPreserveMixin, EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = DataLifecyclePolicy.objects.select_related("created_by")
    pagination_class = CompliancePagination

    def get_queryset(self):
        return filter_lifecycle_policies(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return DataLifecyclePolicyListSerializer
        if self.action == "retrieve":
            return DataLifecyclePolicyDetailSerializer
        return DataLifecyclePolicyWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [ComplianceReadPermission()]
        return [ComplianceManagePermission()]


class LifecycleApplyViewSet(viewsets.ViewSet):
    """POST /compliance/lifecycle/apply：按策略扫描到期数据并真实执行。"""

    permission_classes = [ComplianceSecurityPermission]

    def apply(self, request):
        task_type = request.data.get("task_type") or request.query_params.get("task_type")
        result = lifecycle_service.apply_lifecycle_policies(task_type=task_type, user=request.user)
        return ok(result)
