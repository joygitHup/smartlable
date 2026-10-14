"""工时预估视图(F9.7)：列表 + 触发预估。"""
from rest_framework import viewsets

from common.constants import ErrorCode
from common.response import ok
from tasks.models import Task

from ..constants import WorkforceErrorCode
from ..filters import filter_estimates
from ..models import WorkEstimate
from ..pagination import WorkforcePagination
from ..permissions import WorkforceManagePermission
from ..serializers import WorkEstimateSerializer
from ..services import estimate_service
from ..utils import business_error, to_int
from .base import EnvelopeViewSetMixin


class WorkEstimateViewSet(EnvelopeViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = WorkEstimate.objects.select_related("task", "created_by")
    serializer_class = WorkEstimateSerializer
    pagination_class = WorkforcePagination

    def get_queryset(self):
        return filter_estimates(self.queryset, self.request.query_params)


class EstimateViewSet(viewsets.ViewSet):
    """POST /workforce/estimate：基于历史工时均值预估工时。"""

    permission_classes = [WorkforceManagePermission]

    def create(self, request):
        task_id = request.data.get("task") or request.data.get("task_id")
        if not task_id:
            raise business_error(WorkforceErrorCode.TASK_REQUIRED, status_code=400)
        try:
            task = Task.objects.get(id=task_id)
        except Task.DoesNotExist:
            raise business_error(ErrorCode.NOT_FOUND, "任务不存在", status_code=404)

        estimate = estimate_service.estimate_task_minutes(task, request.user)
        return ok(
            {
                "estimate_id": estimate.id,
                "task_id": task.id,
                "estimated_minutes": estimate.estimated_minutes,
                "method": estimate.method,
                "sample_size": estimate.sample_size,
                "basis": estimate.basis,
            }
        )
