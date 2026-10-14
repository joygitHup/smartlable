"""争议样本视图：列表 / 创建 / 详情 / 认领 / 裁决。"""
from rest_framework import mixins, viewsets
from rest_framework.decorators import action

from common.constants import ErrorCode
from common.response import ok

from ..filters import filter_disputes
from ..models import DisputeSample
from ..pagination import SpecsPagination
from ..permissions import DisputeHandlePermission
from ..serializers import (
    ArbitrationSerializer,
    DisputeSampleDetailSerializer,
    DisputeSampleListSerializer,
    DisputeSampleWriteSerializer,
)
from ..services import dispute_service
from ..utils import business_error
from .base import EnvelopeViewSetMixin


class DisputeSampleViewSet(
    EnvelopeViewSetMixin, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = DisputeSample.objects.select_related("task", "unit", "raised_by", "claimed_by")
    pagination_class = SpecsPagination

    def get_queryset(self):
        qs = super().get_queryset()
        return filter_disputes(qs, self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return DisputeSampleListSerializer
        if self.action == "retrieve":
            return DisputeSampleDetailSerializer
        return DisputeSampleWriteSerializer

    def get_permissions(self):
        if self.action in ("claim", "arbitrate"):
            return [DisputeHandlePermission()]
        return super().get_permissions()

    def perform_create(self, serializer):
        dispute = serializer.save()
        # 争议创建即通知管理员/工程师跟进(F14.2)，best-effort 不阻断主流程
        from ops.services import notification_service  # 延迟导入，避免应用间循环依赖

        notification_service.notify(
            roles=("admin", "engineer"),
            title=f"新争议样本待处理：任务 #{dispute.task_id}",
            content=f"样本 #{dispute.unit_id} 被标记为争议：{dispute.reason or '（无说明）'}",
            category="dispute",
            ref_type="dispute",
            ref_id=dispute.id,
        )

    @action(detail=True, methods=["post"], url_path="claim")
    def claim(self, request, pk=None):
        dispute = self.get_object()
        dispute = dispute_service.claim_dispute(dispute, request.user)
        return ok(DisputeSampleDetailSerializer(dispute).data)

    @action(detail=True, methods=["post"], url_path="arbitrate")
    def arbitrate(self, request, pk=None):
        dispute = self.get_object()
        decision = request.data.get("decision")
        if not decision:
            raise business_error(ErrorCode.INVALID_PARAM, "缺少裁决结论 decision", status_code=400)
        arbitration = dispute_service.arbitrate_dispute(
            dispute, request.user, decision, request.data.get("label"), request.data.get("note", "")
        )
        dispute.refresh_from_db()
        payload = ArbitrationSerializer(arbitration).data
        payload["dispute_status"] = dispute.status
        return ok(payload)
