"""蒸馏作业视图(F15.5)：CRUD + 开始/结束。"""
from rest_framework import viewsets
from rest_framework.decorators import action

from common.response import ok

from ..filters import filter_distillations
from ..models import DistillationJob
from ..pagination import LlmopsPagination
from ..permissions import LlmopsManagePermission, LlmopsReadPermission
from ..serializers import (
    DistillationJobDetailSerializer,
    DistillationJobListSerializer,
    DistillationJobWriteSerializer,
)
from ..services import distillation_service
from .base import EnvelopeViewSetMixin


class DistillationJobViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = DistillationJob.objects.all()
    pagination_class = LlmopsPagination

    def get_queryset(self):
        return filter_distillations(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return DistillationJobListSerializer
        if self.action == "retrieve":
            return DistillationJobDetailSerializer
        return DistillationJobWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [LlmopsReadPermission()]
        return [LlmopsManagePermission()]

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        job = distillation_service.start_job(self.get_object(), request.user)
        return ok(DistillationJobDetailSerializer(job).data)

    @action(detail=True, methods=["post"], url_path="finish")
    def finish(self, request, pk=None):
        job = distillation_service.finish_job(self.get_object(), request.data, request.user)
        return ok(DistillationJobDetailSerializer(job).data)
