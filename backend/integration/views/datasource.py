"""数据源视图(F13.3)：CRUD + 连接校验 + 同步。"""
from rest_framework import viewsets
from rest_framework.decorators import action

from common.response import ok

from ..filters import filter_datasources
from ..models import DataSource
from ..pagination import IntegrationPagination
from ..permissions import IntegrationManagePermission, IntegrationReadPermission
from ..serializers import DataSourceDetailSerializer, DataSourceListSerializer, DataSourceWriteSerializer
from ..services import datasource_service
from .base import CreatorPreserveMixin, EnvelopeViewSetMixin


class DataSourceViewSet(CreatorPreserveMixin, EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = DataSource.objects.select_related("created_by")
    pagination_class = IntegrationPagination

    def get_queryset(self):
        return filter_datasources(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return DataSourceListSerializer
        if self.action == "retrieve":
            return DataSourceDetailSerializer
        return DataSourceWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IntegrationReadPermission()]
        return [IntegrationManagePermission()]

    @action(detail=True, methods=["post"], url_path="test-connection")
    def test_connection(self, request, pk=None):
        return ok(datasource_service.test_connection(self.get_object(), request.user))

    @action(detail=True, methods=["post"], url_path="sync")
    def sync(self, request, pk=None):
        return ok(datasource_service.sync(self.get_object(), request.user))
