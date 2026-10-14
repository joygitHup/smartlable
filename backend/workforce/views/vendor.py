"""供应商团队视图(F9.8)。"""
from rest_framework import viewsets

from ..models import VendorTeam
from ..pagination import WorkforcePagination
from ..permissions import WorkforceManagePermission, WorkforceReadPermission
from ..serializers import VendorTeamSerializer
from .base import EnvelopeViewSetMixin


class VendorTeamViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = VendorTeam.objects.all()
    serializer_class = VendorTeamSerializer
    pagination_class = WorkforcePagination

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [WorkforceReadPermission()]
        return [WorkforceManagePermission()]
