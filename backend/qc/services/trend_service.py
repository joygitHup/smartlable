"""质量趋势监控服务(F11.5)：按天聚合准确率。"""
from django.db import transaction

from core.models import log_action
from tasks.models import Unit

from ..models import QualityTrend
from ..utils import same_label


def _collect_daily(task_type=None, annotator=None, task=None):
    qs = Unit.objects.filter(human_reviewed=True, reviewed_at__isnull=False).select_related("task", "reviewed_by")
    if task is not None:
        qs = qs.filter(task=task)
    if task_type:
        qs = qs.filter(task__task_type=task_type)
    if annotator is not None:
        qs = qs.filter(reviewed_by=annotator)

    buckets = {}
    for unit in qs:
        day = unit.reviewed_at.date()
        key = (day, unit.reviewed_by_id, unit.task_id)
        bucket = buckets.setdefault(key, {"agree": 0, "size": 0})
        if unit.ai_prediction and unit.human_label is not None:
            bucket["size"] += 1
            if same_label(unit.human_label, unit.ai_prediction):
                bucket["agree"] += 1
    return buckets


def compute_trends(task_type=None, annotator=None, task=None) -> list:
    """返回按天的准确率趋势列表。"""
    buckets = _collect_daily(task_type=task_type, annotator=annotator, task=task)
    trends = []
    for (day, annotator_id, task_id), b in buckets.items():
        trends.append(
            {
                "date": day.isoformat(),
                "annotator_id": annotator_id,
                "task_id": task_id,
                "accuracy": round(b["agree"] / b["size"], 4) if b["size"] else None,
                "sample_size": b["size"],
            }
        )
    trends.sort(key=lambda t: (t["date"], t["annotator_id"] or 0, t["task_id"] or 0))
    return trends


@transaction.atomic
def persist_trends(task_type=None, annotator=None, task=None, user=None) -> list:
    """把趋势快照落库到 QualityTrend。"""
    trends = compute_trends(task_type=task_type, annotator=annotator, task=task)
    saved = []
    for t in trends:
        obj, _ = QualityTrend.objects.update_or_create(
            annotator_id=t["annotator_id"],
            task_id=t["task_id"],
            date=t["date"],
            defaults={"accuracy": t["accuracy"] or 0.0, "sample_size": t["sample_size"]},
        )
        saved.append(obj)
    log_action(user, "qc:trends_persist", "task_type", task_type or "all", {"rows": len(saved)})
    return saved
