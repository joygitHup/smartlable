"""反馈视图(F14.6)：CRUD + 处理。"""
from rest_framework import viewsets
from rest_framework.decorators import action

from common.response import ok

from ..filters import filter_feedbacks
from ..models import Feedback
from ..pagination import OpsPagination
from ..permissions import OpsHandlePermission, OpsManagePermission, OpsReadPermission
from ..serializers import FeedbackDetailSerializer, FeedbackListSerializer, FeedbackWriteSerializer
from ..services import feedback_service
from .base import EnvelopeViewSetMixin


class FeedbackViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = Feedback.objects.select_related("user", "handled_by")
    pagination_class = OpsPagination

    def get_queryset(self):
        return filter_feedbacks(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return FeedbackListSerializer
        if self.action == "retrieve":
            return FeedbackDetailSerializer
        return FeedbackWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [OpsReadPermission()]
        if self.action == "create":
            # 任意登录用户均可提交反馈
            return [OpsReadPermission()]
        if self.action == "handle":
            return [OpsHandlePermission()]
        return [OpsManagePermission()]

    @action(detail=True, methods=["post"], url_path="handle")
    def handle(self, request, pk=None):
        status = request.data.get("status")
        response = request.data.get("response", "")
        feedback = feedback_service.handle_feedback(self.get_object(), request.user, status, response)
        return ok(FeedbackDetailSerializer(feedback).data)
