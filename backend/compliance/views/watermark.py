"""水印与溯源视图(F12.2)：只读列表/详情 + 生成水印。"""
from rest_framework import viewsets

from common.response import ok

from ..filters import filter_watermarks
from ..models import Watermark
from ..pagination import CompliancePagination
from ..permissions import ComplianceReadPermission, ComplianceSecurityPermission
from ..serializers import WatermarkGenerateSerializer, WatermarkSerializer
from ..services import watermark_service
from .base import EnvelopeViewSetMixin


class WatermarkViewSet(EnvelopeViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Watermark.objects.select_related("created_by")
    serializer_class = WatermarkSerializer
    pagination_class = CompliancePagination

    def get_queryset(self):
        return filter_watermarks(super().get_queryset(), self.request.query_params)

    def get_permissions(self):
        return [ComplianceReadPermission()]


class WatermarkGenerateViewSet(viewsets.ViewSet):
    """POST /compliance/watermark：生成水印与溯源标识并落库。"""

    permission_classes = [ComplianceSecurityPermission]

    def generate(self, request):
        serializer = WatermarkGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        watermark = watermark_service.generate_watermark(
            data["target_type"], data["target_id"], data.get("text", ""), user=request.user
        )
        return ok(WatermarkSerializer(watermark).data)
