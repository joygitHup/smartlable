"""预标注规则视图(F10.6)：CRUD。"""
from rest_framework import viewsets

from ..filters import filter_rules
from ..models import PrelabelRule
from ..pagination import PrelabelPagination
from ..permissions import PrelabelManagePermission, PrelabelReadPermission
from ..serializers import (
    PrelabelRuleDetailSerializer,
    PrelabelRuleListSerializer,
    PrelabelRuleWriteSerializer,
)
from .base import EnvelopeViewSetMixin


class PrelabelRuleViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = PrelabelRule.objects.select_related("created_by")
    pagination_class = PrelabelPagination

    def get_queryset(self):
        return filter_rules(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return PrelabelRuleListSerializer
        if self.action == "retrieve":
            return PrelabelRuleDetailSerializer
        return PrelabelRuleWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [PrelabelReadPermission()]
        return [PrelabelManagePermission()]
