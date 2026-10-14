"""小模型蒸馏服务(F15.5)：作业状态流转。

说明：真实训练不可用，作业仅做状态流转，finish 时按调用方传入的真实指标落库，不伪造指标。
"""
from django.db import transaction

from core.models import log_action

from ..constants import LLMOPS_ERROR_MESSAGE, LlmopsErrorCode
from ..models import DistillStatus, DistillationJob
from ..utils import business_error


def _err(code, message=None, status_code=400):
    return business_error(code, message or LLMOPS_ERROR_MESSAGE.get(code), status_code=status_code)


@transaction.atomic
def start_job(job: DistillationJob, user=None) -> DistillationJob:
    """开始蒸馏作业（pending/failed → running）。"""
    if job.status not in (DistillStatus.PENDING, DistillStatus.FAILED):
        raise _err(LlmopsErrorCode.INVALID_STATUS, message="仅待开始/失败的作业可启动", status_code=409)
    job.status = DistillStatus.RUNNING
    job.save(update_fields=["status", "updated_at"])
    log_action(user, "llmops:distillation_start", "distillation_job", job.id, {})
    return job


@transaction.atomic
def finish_job(job: DistillationJob, payload: dict, user=None) -> DistillationJob:
    """结束蒸馏作业：落库调用方传入的真实指标（缺失则报错，不伪造）。"""
    if job.status != DistillStatus.RUNNING:
        raise _err(LlmopsErrorCode.INVALID_STATUS, message="仅进行中的作业可结束", status_code=409)
    metrics = payload.get("metrics")
    if not isinstance(metrics, dict) or not metrics:
        raise _err(LlmopsErrorCode.METRICS_REQUIRED, status_code=400)

    failed = bool(payload.get("failed"))
    job.metrics = metrics
    if payload.get("notes"):
        job.notes = payload["notes"]
    job.status = DistillStatus.FAILED if failed else DistillStatus.FINISHED
    job.save(update_fields=["metrics", "notes", "status", "updated_at"])
    log_action(user, "llmops:distillation_finish", "distillation_job", job.id,
               {"status": job.status, "metrics": metrics})
    return job
