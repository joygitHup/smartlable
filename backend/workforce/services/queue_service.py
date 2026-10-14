"""任务队列服务：优先级调整(F9.1)。"""
from django.db import transaction

from core.models import log_action

from ..models import TaskQueueEntry
from tasks.models import Priority

_VALID_PRIORITIES = set(Priority.values)


@transaction.atomic
def reprioritize(entry: TaskQueueEntry, priority, order, actor) -> TaskQueueEntry:
    if priority and priority in _VALID_PRIORITIES:
        entry.priority = priority
    if order is not None:
        entry.order = order
    entry.save(update_fields=["priority", "order", "updated_at"])
    log_action(
        actor, "workforce:reprioritize", "queue", entry.id, {"priority": entry.priority, "order": entry.order}
    )
    return entry
