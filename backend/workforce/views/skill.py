"""技能标签视图(F9.2)。"""
from rest_framework import viewsets

from ..filters import filter_skill_tags
from ..models import SkillTag
from ..pagination import WorkforcePagination
from ..permissions import WorkforceManagePermission, WorkforceReadPermission
from ..serializers import SkillTagSerializer
from .base import EnvelopeViewSetMixin


class SkillTagViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = SkillTag.objects.all()
    serializer_class = SkillTagSerializer
    pagination_class = WorkforcePagination
    lookup_value_regex = "[0-9]+"

    def get_queryset(self):
        return filter_skill_tags(self.queryset, self.request.query_params)

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [WorkforceReadPermission()]
        return [WorkforceManagePermission()]
