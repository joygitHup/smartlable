"""长尾类别策略视图(F10.8)：CRUD。"""
from rest_framework import viewsets

from ..filters import filter_long_tail_policies
from ..models import LongTailPolicy
from ..pagination import PrelabelPagination
from ..permissions import PrelabelManagePermission, PrelabelReadPermission
from ..serializers import (
    LongTailPolicyDetailSerializer,
    LongTailPolicyListSerializer,
    LongTailPolicyWriteSerializer,
)
from .base import EnvelopeViewSetMixin


class LongTailPolicyViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = LongTailPolicy.objects.select_related("created_by")
    pagination_class = PrelabelPagination

    def get_queryset(self):
        return filter_long_tail_policies(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return LongTailPolicyListSerializer
        if self.action == "retrieve":
            return LongTailPolicyDetailSerializer
        return LongTailPolicyWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [PrelabelReadPermission()]
        return [PrelabelManagePermission()]
