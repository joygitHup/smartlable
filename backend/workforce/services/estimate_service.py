"""工时预估服务：基于历史 Worklog 均值(F9.7)。"""
from django.db import transaction
from django.db.models import Avg

from core.models import log_action

from ..constants import WorkforceErrorCode
from ..models import WorkEstimate, Worklog
from ..utils import business_error


@transaction.atomic
def estimate_task_minutes(task, actor) -> WorkEstimate:
    logs = Worklog.objects.filter(task=task)
    scope = "task"
    if not logs.exists():
        # 回退到同任务类型的历史工时
        logs = Worklog.objects.filter(task__task_type=task.task_type)
        scope = "task_type"

    sample_size = logs.count()
    if not sample_size:
        raise business_error(WorkforceErrorCode.NO_HISTORY, status_code=400)

    avg = logs.aggregate(m=Avg("effective_minutes"))["m"] or 0.0
    minutes = int(round(avg))
    estimate = WorkEstimate.objects.create(
        task=task,
        estimated_minutes=minutes,
        method="history_mean",
        sample_size=sample_size,
        basis={"scope": scope, "avg_minutes": round(float(avg), 2)},
        created_by=actor,
    )
    log_action(actor, "workforce:estimate", "task", task.id, {"minutes": minutes, "sample": sample_size})
    return estimate
