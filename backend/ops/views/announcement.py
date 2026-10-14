"""公告视图(F14.2)：CRUD + 发布。"""
from rest_framework import viewsets
from rest_framework.decorators import action

from common.response import ok

from ..filters import filter_announcements
from ..models import Announcement
from ..pagination import OpsPagination
from ..permissions import OpsManagePermission, OpsReadPermission
from ..serializers import AnnouncementDetailSerializer, AnnouncementListSerializer, AnnouncementWriteSerializer
from ..services import announcement_service
from .base import EnvelopeViewSetMixin


class AnnouncementViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = Announcement.objects.select_related("created_by")
    pagination_class = OpsPagination

    def get_queryset(self):
        return filter_announcements(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return AnnouncementListSerializer
        if self.action == "retrieve":
            return AnnouncementDetailSerializer
        return AnnouncementWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [OpsReadPermission()]
        return [OpsManagePermission()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        announcement = self.get_object()
        result = announcement_service.publish_announcement(announcement, request.user)
        return ok({"announcement": AnnouncementDetailSerializer(result["announcement"]).data,
                   "notified": result["notified"]})
