"""通知视图(F14.2)：仅当前用户只读列表 + 标记已读。"""
from rest_framework import mixins, viewsets
from rest_framework.decorators import action

from common.response import ok
from core.models import log_action

from ..filters import filter_notifications
from ..models import Notification
from ..pagination import OpsPagination
from ..permissions import OpsReadPermission
from ..serializers import NotificationDetailSerializer, NotificationListSerializer
from ..services import notification_service
from .base import EnvelopeViewSetMixin


class NotificationViewSet(
    EnvelopeViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Notification.objects.select_related("recipient")
    pagination_class = OpsPagination
    permission_classes = [OpsReadPermission]

    def get_queryset(self):
        qs = super().get_queryset().filter(recipient=self.request.user)
        return filter_notifications(qs, self.request.query_params)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return NotificationDetailSerializer
        return NotificationListSerializer

    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, pk=None):
        notification = notification_service.mark_read(self.get_object(), request.user)
        log_action(request.user, "ops:notification_read", "notification", notification.id)
        return ok(NotificationDetailSerializer(notification).data)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        count = notification_service.mark_all_read(request.user)
        log_action(request.user, "ops:notification_read_all", "notification", "", {"count": count})
        return ok({"marked": count})
