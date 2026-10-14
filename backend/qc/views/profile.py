"""标注员能力画像与质量趋势视图(F11.4/F11.5)：只读。"""
from rest_framework import viewsets

from ..filters import filter_profiles, filter_trends
from ..models import AnnotatorProfile, QualityTrend
from ..pagination import QcPagination
from ..permissions import QcDetectPermission
from ..serializers import (
    AnnotatorProfileDetailSerializer,
    AnnotatorProfileListSerializer,
    QualityTrendSerializer,
)
from .base import EnvelopeViewSetMixin


class AnnotatorProfileViewSet(EnvelopeViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = AnnotatorProfile.objects.select_related("annotator")
    pagination_class = QcPagination

    def get_queryset(self):
        return filter_profiles(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return AnnotatorProfileListSerializer
        return AnnotatorProfileDetailSerializer

    def get_permissions(self):
        return [QcDetectPermission()]


class QualityTrendViewSet(EnvelopeViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = QualityTrend.objects.select_related("annotator", "task")
    serializer_class = QualityTrendSerializer
    pagination_class = QcPagination

    def get_queryset(self):
        return filter_trends(super().get_queryset(), self.request.query_params)

    def get_permissions(self):
        return [QcDetectPermission()]
