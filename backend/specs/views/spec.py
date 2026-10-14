"""规范文档与版本视图。"""
from django.db.models import Prefetch
from rest_framework import viewsets
from rest_framework.decorators import action

from common.constants import ErrorCode
from common.response import ok

from ..filters import filter_spec_documents
from ..models import SpecDocument, SpecVersion
from ..pagination import SpecsPagination
from ..permissions import SpecManagePermission, SpecPublishPermission, SpecReadPermission
from ..serializers import (
    SpecDocumentDetailSerializer,
    SpecDocumentListSerializer,
    SpecDocumentWriteSerializer,
    SpecVersionSerializer,
    SpecVersionWriteSerializer,
)
from ..services import spec_service
from ..utils import business_error, to_int
from .base import EnvelopeViewSetMixin


class SpecDocumentViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = SpecDocument.objects.select_related("created_by", "task")
    pagination_class = SpecsPagination

    def get_queryset(self):
        qs = super().get_queryset().prefetch_related(
            Prefetch("versions", queryset=SpecVersion.objects.select_related("created_by"))
        )
        return filter_spec_documents(qs, self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return SpecDocumentListSerializer
        if self.action == "retrieve":
            return SpecDocumentDetailSerializer
        return SpecDocumentWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [SpecReadPermission()]
        if self.action in ("publish", "generate_draft", "impact", "relabel_impact"):
            return [SpecPublishPermission()]
        return [SpecManagePermission()]

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        # 保留原始创建人，避免更新时被当前用户覆盖
        serializer.save(created_by=self.get_object().created_by)

    @action(detail=True, methods=["get", "post"], url_path="versions")
    def versions(self, request, pk=None):
        spec = self.get_object()
        if request.method == "GET":
            serializer = SpecVersionSerializer(spec.versions.all(), many=True)
            return ok(serializer.data)
        write = SpecVersionWriteSerializer(data=request.data)
        write.is_valid(raise_exception=True)
        data = write.validated_data
        version = to_int(data.get("version"), 0)
        if version <= 0:
            raise business_error(ErrorCode.INVALID_PARAM, "版本号必须为正整数", status_code=400)
        ver = spec_service.create_version(
            spec, version, data.get("content", ""), data.get("change_note", ""), request.user
        )
        return ok(SpecVersionSerializer(ver).data)

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        spec = self.get_object()
        version = to_int(request.data.get("version"), 0)
        if version <= 0:
            raise business_error(ErrorCode.INVALID_PARAM, "缺少有效的版本号", status_code=400)
        ver = spec_service.publish_version(spec, version, request.user)
        spec.refresh_from_db()
        return ok({"spec_id": spec.id, "current_version": spec.current_version, "status": spec.status,
                   "version": SpecVersionSerializer(ver).data})

    @action(detail=True, methods=["post"], url_path="generate-draft")
    def generate_draft(self, request, pk=None):
        spec = self.get_object()
        return ok(spec_service.generate_draft(spec, request.user))

    @action(detail=True, methods=["get"], url_path="impact")
    def impact(self, request, pk=None):
        spec = self.get_object()
        from_version = to_int(request.query_params.get("from"), None)
        to_version = to_int(request.query_params.get("to"), None)
        return ok(spec_service.impact_analysis(spec, from_version, to_version))

    @action(detail=True, methods=["post"], url_path="relabel-impact")
    def relabel_impact(self, request, pk=None):
        spec = self.get_object()
        from_version = to_int(request.data.get("from"), None)
        to_version = to_int(request.data.get("to"), None)
        result = spec_service.create_relabel_rework(
            spec, from_version, to_version, request.user, request.data.get("reason", "")
        )
        return ok(result)
