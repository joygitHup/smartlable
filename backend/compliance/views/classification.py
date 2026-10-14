"""数据分级分类与分级策略视图(F12.1)。"""
from rest_framework import viewsets

from ..filters import filter_classifications, filter_policies
from ..models import DataClassPolicy, DataClassification
from ..pagination import CompliancePagination
from ..permissions import ComplianceManagePermission, ComplianceReadPermission
from ..serializers import (
    DataClassPolicyDetailSerializer,
    DataClassPolicyListSerializer,
    DataClassPolicyWriteSerializer,
    DataClassificationDetailSerializer,
    DataClassificationListSerializer,
    DataClassificationWriteSerializer,
)
from .base import CreatorPreserveMixin, EnvelopeViewSetMixin


class DataClassificationViewSet(CreatorPreserveMixin, EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = DataClassification.objects.select_related("created_by")
    pagination_class = CompliancePagination

    def get_queryset(self):
        return filter_classifications(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return DataClassificationListSerializer
        if self.action == "retrieve":
            return DataClassificationDetailSerializer
        return DataClassificationWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [ComplianceReadPermission()]
        return [ComplianceManagePermission()]


class DataClassPolicyViewSet(CreatorPreserveMixin, EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = DataClassPolicy.objects.select_related("created_by")
    pagination_class = CompliancePagination

    def get_queryset(self):
        return filter_policies(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return DataClassPolicyListSerializer
        if self.action == "retrieve":
            return DataClassPolicyDetailSerializer
        return DataClassPolicyWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [ComplianceReadPermission()]
        return [ComplianceManagePermission()]
