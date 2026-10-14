"""A/B 实验视图(F10.7)：CRUD + 运行 / 结束。"""
from rest_framework import viewsets
from rest_framework.decorators import action

from common.response import ok

from ..filters import filter_experiments
from ..models import ABExperiment
from ..pagination import PrelabelPagination
from ..permissions import PrelabelReadPermission, PrelabelTunePermission
from ..serializers import (
    ABExperimentDetailSerializer,
    ABExperimentListSerializer,
    ABExperimentWriteSerializer,
)
from ..services import experiment_service
from .base import EnvelopeViewSetMixin


class ABExperimentViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = ABExperiment.objects.select_related("task", "created_by")
    pagination_class = PrelabelPagination

    def get_queryset(self):
        return filter_experiments(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return ABExperimentListSerializer
        if self.action == "retrieve":
            return ABExperimentDetailSerializer
        return ABExperimentWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [PrelabelReadPermission()]
        return [PrelabelTunePermission()]

    @action(detail=True, methods=["post"], url_path="run")
    def run(self, request, pk=None):
        experiment = experiment_service.run_experiment(self.get_object(), request.user)
        return ok(ABExperimentDetailSerializer(experiment).data)

    @action(detail=True, methods=["post"], url_path="finish")
    def finish(self, request, pk=None):
        winner = request.data.get("winner")
        experiment = experiment_service.finish_experiment(self.get_object(), request.user, winner)
        return ok(ABExperimentDetailSerializer(experiment).data)
