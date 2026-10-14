"""多轮标注视图(F15.6)：CRUD + 下一轮。"""
from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action

from common.constants import ErrorCode
from common.response import ok
from core.models import User

from ..filters import filter_rounds
from ..models import MultiRoundSession
from ..pagination import LlmopsPagination
from ..permissions import LlmopsManagePermission, LlmopsReadPermission
from ..serializers import (
    MultiRoundSessionDetailSerializer,
    MultiRoundSessionListSerializer,
    MultiRoundSessionWriteSerializer,
    RoundRecordSerializer,
)
from ..services import round_service
from ..utils import business_error
from .base import EnvelopeViewSetMixin


class MultiRoundSessionViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = MultiRoundSession.objects.select_related("task", "unit")
    pagination_class = LlmopsPagination

    def get_queryset(self):
        qs = super().get_queryset().annotate(_round_count=Count("rounds"))
        if self.action == "retrieve":
            qs = qs.prefetch_related("rounds")
        return filter_rounds(qs, self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return MultiRoundSessionListSerializer
        if self.action == "retrieve":
            return MultiRoundSessionDetailSerializer
        return MultiRoundSessionWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [LlmopsReadPermission()]
        return [LlmopsManagePermission()]

    @action(detail=True, methods=["post"], url_path="next")
    def next_round(self, request, pk=None):
        session = self.get_object()
        annotator = None
        annotator_id = request.data.get("annotator") or request.data.get("annotator_id")
        if annotator_id:
            try:
                annotator = User.objects.get(id=annotator_id)
            except User.DoesNotExist:
                raise business_error(ErrorCode.NOT_FOUND, "标注员不存在", status_code=404)
        session, record = round_service.advance_round(
            session,
            label=request.data.get("label"),
            annotator=annotator,
            notes=request.data.get("notes", ""),
            user=request.user,
        )
        session = self.get_queryset().get(pk=session.pk)
        return ok({"session": MultiRoundSessionDetailSerializer(session).data,
                   "record": RoundRecordSerializer(record).data})
