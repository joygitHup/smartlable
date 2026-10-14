"""LLM 成本视图(F15.2)：只读列表 + 创建记录 + 汇总。"""
from django.utils.dateparse import parse_date
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action

from common.response import ok

from ..filters import filter_costs
from ..models import LLMCostRecord
from ..pagination import LlmopsPagination
from ..permissions import LlmopsManagePermission, LlmopsReadPermission
from ..serializers import LLMCostRecordSerializer, LLMCostRecordWriteSerializer
from ..services import cost_service
from .base import EnvelopeViewSetMixin


class LLMCostRecordViewSet(
    EnvelopeViewSetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = LLMCostRecord.objects.select_related("task", "unit")
    pagination_class = LlmopsPagination

    def get_queryset(self):
        return filter_costs(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "create":
            return LLMCostRecordWriteSerializer
        return LLMCostRecordSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "summary"):
            return [LlmopsReadPermission()]
        return [LlmopsManagePermission()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        record = cost_service.record_cost(
            task=data.get("task"),
            unit=data.get("unit"),
            model=data.get("model", ""),
            prompt_tokens=data.get("prompt_tokens", 0),
            completion_tokens=data.get("completion_tokens", 0),
            total_tokens=data.get("total_tokens"),
            cost=data.get("cost", 0),
            user=request.user,
        )
        response = ok(LLMCostRecordSerializer(record).data)
        response.status_code = status.HTTP_201_CREATED
        return response

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        start = parse_date(request.query_params.get("start", ""))
        end = parse_date(request.query_params.get("end", ""))
        return ok(cost_service.summarize(start=start, end=end))
