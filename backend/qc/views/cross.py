"""交叉复核视图(F11.3)：CRUD。"""
from rest_framework import viewsets

from ..filters import filter_cross_reviews
from ..models import CrossReview
from ..pagination import QcPagination
from ..permissions import QcManagePermission, QcReadPermission
from ..serializers import CrossReviewDetailSerializer, CrossReviewListSerializer, CrossReviewWriteSerializer
from .base import EnvelopeViewSetMixin


class CrossReviewViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = CrossReview.objects.select_related("unit", "reviewer_a", "reviewer_b")
    pagination_class = QcPagination

    def get_queryset(self):
        return filter_cross_reviews(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return CrossReviewListSerializer
        if self.action == "retrieve":
            return CrossReviewDetailSerializer
        return CrossReviewWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [QcReadPermission()]
        return [QcManagePermission()]
