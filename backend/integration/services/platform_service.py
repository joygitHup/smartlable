"""训练平台推送服务(F13.4)：组装已审核结果并真实推送，记录 PushRecord。"""
from django.db import transaction

from core.models import log_action
from tasks.models import Task, Unit

from ..models import PushStatus, TrainingPlatform
from ..utils import post_json


def build_payload(task: Task) -> dict:
    """把任务下已人工审核的 Unit 结果组装为推送载荷。"""
    units = Unit.objects.filter(task=task, human_reviewed=True).order_by("id")
    items = [
        {"unit_id": u.id, "content": u.content, "label": u.human_label, "status": u.status}
        for u in units
    ]
    return {
        "task_id": task.id,
        "task_name": task.name,
        "task_type": task.task_type,
        "count": len(items),
        "items": items,
    }


@transaction.atomic
def _save_record(platform, task, status, payload, response, user=None):
    from ..models import PushRecord

    record = PushRecord.objects.create(
        platform=platform, task=task, status=status, payload=payload, response=response, created_by=user
    )
    log_action(user, "integration:platform_push", "training_platform", platform.id,
               {"task_id": task.id, "record_id": record.id, "status": status})
    return record


def push_results(platform: TrainingPlatform, task: Task, user=None):
    """向训练平台真实推送已审核结果并记录 PushRecord（失败如实记录）。"""
    payload = build_payload(task)
    endpoint = platform.endpoint or (platform.config or {}).get("endpoint") or ""

    if not endpoint:
        with transaction.atomic():
            return _save_record(platform, task, PushStatus.FAILED, payload,
                                {"error": "平台未配置 endpoint"}, user)

    token = (platform.config or {}).get("token")
    headers = {"Authorization": f"Bearer {token}"} if token else None
    result = post_json(endpoint, payload, headers=headers)
    status = PushStatus.SUCCESS if result["ok"] else PushStatus.FAILED
    response = {
        "status_code": result["status_code"],
        "body": (result["body"] or "")[:2000],
        "error": result["error"],
    }
    with transaction.atomic():
        return _save_record(platform, task, status, payload, response, user)
