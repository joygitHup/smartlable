"""合规检查视图(F12.6)：清单 CRUD + 结果列表/创建 + 评估。"""
from rest_framework import mixins, viewsets
from rest_framework.decorators import action

from common.response import ok

from ..filters import filter_checks, filter_checklists
from ..models import ComplianceCheckResult, ComplianceChecklist
from ..pagination import CompliancePagination
from ..permissions import ComplianceManagePermission, ComplianceReadPermission
from ..serializers import (
    ComplianceCheckResultDetailSerializer,
    ComplianceCheckResultListSerializer,
    ComplianceCheckResultWriteSerializer,
    ComplianceChecklistDetailSerializer,
    ComplianceChecklistListSerializer,
    ComplianceChecklistWriteSerializer,
)
from ..services import checklist_service
from .base import CreatorPreserveMixin, EnvelopeViewSetMixin


class ComplianceChecklistViewSet(CreatorPreserveMixin, EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = ComplianceChecklist.objects.select_related("created_by")
    pagination_class = CompliancePagination

    def get_queryset(self):
        return filter_checklists(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return ComplianceChecklistListSerializer
        if self.action == "retrieve":
            return ComplianceChecklistDetailSerializer
        return ComplianceChecklistWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [ComplianceReadPermission()]
        return [ComplianceManagePermission()]


class ComplianceCheckResultViewSet(
    EnvelopeViewSetMixin, mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    queryset = ComplianceCheckResult.objects.select_related("checklist", "checked_by")
    pagination_class = CompliancePagination

    def get_queryset(self):
        return filter_checks(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return ComplianceCheckResultListSerializer
        return ComplianceCheckResultWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [ComplianceReadPermission()]
        return [ComplianceManagePermission()]

    def create(self, request, *args, **kwargs):
        write = ComplianceCheckResultWriteSerializer(data=request.data, context=self.get_serializer_context())
        write.is_valid(raise_exception=True)
        result = write.save()
        return ok(ComplianceCheckResultDetailSerializer(result).data)

    @action(detail=True, methods=["post"], url_path="evaluate")
    def evaluate(self, request, pk=None):
        result = checklist_service.evaluate_result(
            self.get_object(),
            request.data.get("status"),
            request.data.get("note", ""),
            request.user,
        )
        return ok(ComplianceCheckResultDetailSerializer(result).data)
