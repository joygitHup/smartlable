"""开放 API 客户端视图(F13.1)：CRUD + 密钥轮换。"""
from rest_framework import viewsets
from rest_framework.decorators import action

from common.response import ok

from ..filters import filter_clients
from ..models import APIClient
from ..pagination import IntegrationPagination
from ..permissions import IntegrationManagePermission, IntegrationReadPermission, IntegrationSecretPermission
from ..serializers import APIClientDetailSerializer, APIClientListSerializer, APIClientWriteSerializer
from ..services import client_service
from ..utils import gen_key, gen_secret
from .base import CreatorPreserveMixin, EnvelopeViewSetMixin


class APIClientViewSet(CreatorPreserveMixin, EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = APIClient.objects.select_related("created_by")
    pagination_class = IntegrationPagination

    def get_queryset(self):
        return filter_clients(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return APIClientListSerializer
        if self.action == "retrieve":
            return APIClientDetailSerializer
        return APIClientWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IntegrationReadPermission()]
        if self.action == "rotate":
            return [IntegrationSecretPermission()]
        return [IntegrationManagePermission()]

    def perform_create(self, serializer):
        serializer.save(key=gen_key(), secret=gen_secret())

    def perform_update(self, serializer):
        # key/secret 不在写入字段内，更新时保留创建人
        creator = getattr(self.get_object(), "created_by", None)
        serializer.save(created_by=creator)

    @action(detail=True, methods=["post"], url_path="rotate")
    def rotate(self, request, pk=None):
        client = client_service.rotate_client(self.get_object(), request.user)
        return ok(APIClientDetailSerializer(client).data)
