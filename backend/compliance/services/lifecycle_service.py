"""数据生命周期执行服务(F12.5)：按策略扫描到期数据并真实执行软删除/归档标记。"""
from datetime import timedelta

from django.db import transaction
from django.db.models import Q

from core.models import log_action
from tasks.models import Unit

from ..constants import LIFECYCLE_ARCHIVE_MARK, LIFECYCLE_DELETE_MARK
from ..models import DataLifecyclePolicy, LifecycleAction
from ..utils import now

# 已标记过的数据不再重复处理
_MARKED = [LIFECYCLE_DELETE_MARK, LIFECYCLE_ARCHIVE_MARK]


@transaction.atomic
def apply_lifecycle_policies(task_type: str = None, user=None) -> dict:
    """按启用的策略扫描 Unit.created_at 到期数据，执行软删除或归档标记。

    说明：tasks.Unit 未提供独立软删除字段，此处以其 status 写入生命周期标记，
    使到期数据不再进入常规（按状态过滤）的处理流程；不物理删除，可追溯。
    """
    policies = DataLifecyclePolicy.objects.filter(enabled=True)
    if task_type:
        policies = policies.filter(Q(applies_to_task_type=task_type) | Q(applies_to_task_type=""))

    results = []
    total = 0
    for policy in policies:
        cutoff = now() - timedelta(days=policy.retention_days)
        qs = Unit.objects.filter(created_at__lt=cutoff).exclude(status__in=_MARKED)
        if policy.applies_to_task_type:
            qs = qs.filter(task__task_type=policy.applies_to_task_type)
        mark = LIFECYCLE_DELETE_MARK if policy.action == LifecycleAction.DELETE else LIFECYCLE_ARCHIVE_MARK
        processed = qs.update(status=mark)
        results.append({
            "policy_id": policy.id,
            "level": policy.level,
            "action": policy.action,
            "processed": processed,
        })
        total += processed

    log_action(user, "compliance:lifecycle_apply", "unit_batch", total,
               {"total": total, "results": results})
    return {"total": total, "results": results}
