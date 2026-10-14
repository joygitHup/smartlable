"""分配相关视图：分配记录列表 + 触发分配(F9.2/F9.3)。"""
from rest_framework import viewsets

from common.constants import ErrorCode
from common.response import ok
from tasks.models import Task

from ..constants import WorkforceErrorCode
from ..filters import filter_assignments
from ..models import Assignment
from ..pagination import WorkforcePagination
from ..permissions import WorkforceAssignPermission
from ..serializers import AssignmentSerializer
from ..services import assignment_service
from ..utils import business_error, to_int
from .base import EnvelopeViewSetMixin


class AssignmentViewSet(EnvelopeViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Assignment.objects.select_related("task", "unit", "assignee", "assigned_by")
    serializer_class = AssignmentSerializer
    pagination_class = WorkforcePagination

    def get_queryset(self):
        return filter_assignments(self.queryset, self.request.query_params)


class AssignViewSet(viewsets.ViewSet):
    """POST /workforce/assign：按技能+负载触发一次分配。"""

    permission_classes = [WorkforceAssignPermission]

    def assign(self, request):
        task_id = request.data.get("task") or request.data.get("task_id")
        if not task_id:
            raise business_error(WorkforceErrorCode.TASK_REQUIRED, status_code=400)
        try:
            task = Task.objects.get(id=task_id)
        except Task.DoesNotExist:
            raise business_error(ErrorCode.NOT_FOUND, "任务不存在", status_code=404)

        count = to_int(request.data.get("count"), 1) or 1
        results = assignment_service.allocate(
            task, request.user, count=count, required_skills=request.data.get("skills")
        )
        return ok({"assigned": len(results), "assignments": results})
