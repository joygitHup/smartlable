"""Prompt 管理视图(F15.1)：CRUD + 版本列表/创建 + 发布。"""
from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action

from common.response import ok

from ..filters import filter_prompts
from ..models import PromptTemplate
from ..pagination import LlmopsPagination
from ..permissions import LlmopsManagePermission, LlmopsReadPermission
from ..serializers import (
    PromptTemplateDetailSerializer,
    PromptTemplateListSerializer,
    PromptTemplateWriteSerializer,
    PromptVersionSerializer,
    PromptVersionWriteSerializer,
)
from ..services import prompt_service
from ..utils import to_int
from .base import EnvelopeViewSetMixin


class PromptTemplateViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = PromptTemplate.objects.all()
    pagination_class = LlmopsPagination

    def get_queryset(self):
        qs = super().get_queryset().annotate(_version_count=Count("versions"))
        if self.action == "retrieve":
            qs = qs.prefetch_related("versions")
        return filter_prompts(qs, self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return PromptTemplateListSerializer
        if self.action == "retrieve":
            return PromptTemplateDetailSerializer
        return PromptTemplateWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [LlmopsReadPermission()]
        return [LlmopsManagePermission()]

    @action(detail=True, methods=["get", "post"], url_path="versions")
    def versions(self, request, pk=None):
        template = self.get_object()
        if request.method == "GET":
            versions = template.versions.all()
            data = PromptVersionSerializer(versions, many=True).data
            return ok({"versions": data, "count": len(data)})

        serializer = PromptVersionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        version = prompt_service.create_version(
            template,
            content=serializer.validated_data["content"],
            change_note=serializer.validated_data.get("change_note", ""),
            user=request.user,
        )
        return ok(PromptVersionSerializer(version).data)

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        template = self.get_object()
        version_no = to_int(request.data.get("version_no") or request.data.get("version"), 0)
        template = prompt_service.publish_version(template, version_no=version_no, user=request.user)
        return ok(PromptTemplateDetailSerializer(template).data)
