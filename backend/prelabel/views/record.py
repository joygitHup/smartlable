"""预标注记录与动作视图(F10.3/F10.4/F10.5/F10.6)。"""
from rest_framework import viewsets

from common.response import ok

from ..filters import filter_prelabel_records
from ..models import PrelabelRecord
from ..pagination import PrelabelPagination
from ..permissions import PrelabelActionPermission, PrelabelReadPermission
from ..serializers import PrelabelRecordDetailSerializer, PrelabelRecordListSerializer
from ..services import prelabel_service
from .base import EnvelopeViewSetMixin


class PrelabelRecordViewSet(EnvelopeViewSetMixin, viewsets.ReadOnlyModelViewSet):
    """预标注记录只读列表/详情。"""

    queryset = PrelabelRecord.objects.select_related("unit", "task")
    pagination_class = PrelabelPagination

    def get_queryset(self):
        return filter_prelabel_records(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return PrelabelRecordListSerializer
        return PrelabelRecordDetailSerializer

    def get_permissions(self):
        return [PrelabelReadPermission()]


class PrelabelOperationsViewSet(viewsets.ViewSet):
    """预标注动作：解释 / 多模型对比 / 失败降级 / 规则应用。"""

    permission_classes = [PrelabelActionPermission]

    def _unit_id(self, request):
        return (
            request.data.get("unit")
            or request.data.get("unit_id")
            or request.query_params.get("unit")
            or request.query_params.get("unit_id")
        )

    def explain(self, request):
        unit = prelabel_service.get_unit(self._unit_id(request))
        return ok(prelabel_service.explain_unit(unit))

    def compare(self, request):
        unit = prelabel_service.get_unit(self._unit_id(request))
        if request.method == "GET":
            record = PrelabelRecord.objects.filter(unit=unit).order_by("-created_at").first()
            return ok(
                {
                    "unit_id": unit.id,
                    "record_id": record.id if record else None,
                    "candidates": record.candidates if record else [],
                    "chosen_model": record.chosen_model if record else "",
                    "agreement": (record.explanation or {}).get("agreement") if record else None,
                }
            )
        candidates = request.data.get("candidates")
        result = prelabel_service.compare_models(unit, candidates, request.user)
        return ok(result)

    def fallback(self, request):
        unit = prelabel_service.get_unit(self._unit_id(request))
        reason = request.data.get("fallback_reason") or request.data.get("reason")
        record = prelabel_service.fallback_unit(unit, reason, request.user)
        return ok(
            {
                "record_id": record.id,
                "unit_id": unit.id,
                "unit_status": unit.status,
                "fallback_reason": record.fallback_reason,
            },
            message="已降级为待人工审核",
        )

    def apply_rules(self, request):
        unit = prelabel_service.get_unit(self._unit_id(request))
        return ok(prelabel_service.apply_rules(unit, request.user))
