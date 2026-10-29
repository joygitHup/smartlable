"""SSO 配置视图(F13.5)：CRUD（仅管理员可写）。"""
from rest_framework import viewsets

from ..filters import filter_sso_configs
from ..models import SSOConfig
from ..pagination import IntegrationPagination
from ..permissions import IntegrationSSOReadPermission, IntegrationSecretPermission
from ..serializers import SSOConfigDetailSerializer, SSOConfigListSerializer, SSOConfigWriteSerializer
from .base import CreatorPreserveMixin, EnvelopeViewSetMixin


class SSOConfigViewSet(CreatorPreserveMixin, EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = SSOConfig.objects.select_related("created_by")
    pagination_class = IntegrationPagination

    def get_queryset(self):
        return filter_sso_configs(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return SSOConfigListSerializer
        if self.action == "retrieve":
            return SSOConfigDetailSerializer
        return SSOConfigWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IntegrationSSOReadPermission()]
        return [IntegrationSecretPermission()]
