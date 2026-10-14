"""金标样本与注入记录视图(F11.1)。"""
from rest_framework import viewsets

from ..filters import filter_gold_samples
from ..models import GoldInjection, GoldSample
from ..pagination import QcPagination
from ..permissions import QcManagePermission, QcReadPermission
from ..serializers import (
    GoldInjectionSerializer,
    GoldSampleDetailSerializer,
    GoldSampleListSerializer,
    GoldSampleWriteSerializer,
)
from .base import EnvelopeViewSetMixin


class GoldSampleViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = GoldSample.objects.select_related("task", "created_by")
    pagination_class = QcPagination

    def get_queryset(self):
        return filter_gold_samples(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return GoldSampleListSerializer
        if self.action == "retrieve":
            return GoldSampleDetailSerializer
        return GoldSampleWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [QcReadPermission()]
        return [QcManagePermission()]


class GoldInjectionViewSet(EnvelopeViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = GoldInjection.objects.select_related("task", "sample", "unit", "assigned_to")
    serializer_class = GoldInjectionSerializer
    pagination_class = QcPagination

    def get_queryset(self):
        qs = super().get_queryset()
        task = self.request.query_params.get("task") or self.request.query_params.get("task_id")
        if task:
            qs = qs.filter(task_id=task)
        return qs
