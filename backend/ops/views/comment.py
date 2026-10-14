"""评论视图(F14.1)：CRUD。"""
from rest_framework import viewsets

from core.models import log_action

from ..filters import filter_comments
from ..models import Comment
from ..pagination import OpsPagination
from ..permissions import OpsManagePermission, OpsReadPermission
from ..serializers import CommentDetailSerializer, CommentListSerializer, CommentWriteSerializer
from .base import EnvelopeViewSetMixin


class CommentViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = Comment.objects.select_related("author", "task")
    pagination_class = OpsPagination

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == "retrieve":
            qs = qs.prefetch_related("replies")
        return filter_comments(qs, self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return CommentListSerializer
        if self.action == "retrieve":
            return CommentDetailSerializer
        return CommentWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [OpsReadPermission()]
        return [OpsManagePermission()]

    def perform_create(self, serializer):
        comment = serializer.save()
        log_action(self.request.user, "ops:comment_create", "comment", comment.id, {"task_id": comment.task_id})
