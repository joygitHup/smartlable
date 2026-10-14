"""申诉视图(F11.7)：CRUD + 处理申诉。"""
from rest_framework import viewsets
from rest_framework.decorators import action

from common.response import ok

from ..filters import filter_appeals
from ..models import Appeal
from ..pagination import QcPagination
from ..permissions import QcAppealHandlePermission, QcManagePermission, QcReadPermission
from ..serializers import AppealDetailSerializer, AppealListSerializer, AppealWriteSerializer
from ..services import appeal_service
from .base import EnvelopeViewSetMixin


class AppealViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = Appeal.objects.select_related("annotator", "unit", "handled_by")
    pagination_class = QcPagination

    def get_queryset(self):
        return filter_appeals(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return AppealListSerializer
        if self.action == "retrieve":
            return AppealDetailSerializer
        return AppealWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [QcReadPermission()]
        if self.action == "handle":
            return [QcAppealHandlePermission()]
        return [QcManagePermission()]

    @action(detail=True, methods=["post"], url_path="handle")
    def handle(self, request, pk=None):
        status = request.data.get("status")
        resolution = request.data.get("resolution", "")
        appeal = appeal_service.handle_appeal(self.get_object(), request.user, status, resolution)
        return ok(AppealDetailSerializer(appeal).data)
