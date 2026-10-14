"""作弊检测视图(F11.2)：只读列表/详情。"""
from rest_framework import viewsets

from ..filters import filter_cheat_detections
from ..models import CheatDetection
from ..pagination import QcPagination
from ..permissions import QcDetectPermission
from ..serializers import CheatDetectionDetailSerializer, CheatDetectionListSerializer
from .base import EnvelopeViewSetMixin


class CheatDetectionViewSet(EnvelopeViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = CheatDetection.objects.select_related("task", "annotator")
    pagination_class = QcPagination

    def get_queryset(self):
        return filter_cheat_detections(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return CheatDetectionListSerializer
        return CheatDetectionDetailSerializer

    def get_permissions(self):
        return [QcDetectPermission()]
