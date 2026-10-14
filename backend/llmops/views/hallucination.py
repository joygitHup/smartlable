"""幻觉检测视图(F15.3)：只读列表/详情 + 检测。"""
from rest_framework import mixins, viewsets
from rest_framework.decorators import action

from common.constants import ErrorCode
from common.response import ok
from tasks.models import Unit

from ..constants import LLMOPS_ERROR_MESSAGE, LlmopsErrorCode
from ..filters import filter_hallucinations
from ..models import HallucinationCheck
from ..pagination import LlmopsPagination
from ..permissions import LlmopsManagePermission, LlmopsReadPermission
from ..serializers import HallucinationCheckDetailSerializer, HallucinationCheckListSerializer
from ..services import hallucination_service
from ..utils import business_error
from .base import EnvelopeViewSetMixin


class HallucinationCheckViewSet(
    EnvelopeViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = HallucinationCheck.objects.select_related("unit")
    pagination_class = LlmopsPagination

    def get_queryset(self):
        return filter_hallucinations(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return HallucinationCheckDetailSerializer
        return HallucinationCheckListSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [LlmopsReadPermission()]
        return [LlmopsManagePermission()]

    @action(detail=False, methods=["post"], url_path="detect")
    def detect(self, request):
        unit_id = request.data.get("unit") or request.data.get("unit_id")
        if not unit_id:
            raise business_error(LlmopsErrorCode.UNIT_REQUIRED, status_code=400)
        try:
            unit = Unit.objects.select_related("task").get(id=unit_id)
        except Unit.DoesNotExist:
            raise business_error(ErrorCode.NOT_FOUND, LLMOPS_ERROR_MESSAGE[LlmopsErrorCode.UNIT_NOT_FOUND],
                                 status_code=404)
        check = hallucination_service.detect(unit, model=request.data.get("model", ""), user=request.user)
        return ok(HallucinationCheckDetailSerializer(check).data)
