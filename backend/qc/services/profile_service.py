"""标注员能力画像重建服务(F11.4)。"""
from django.db import transaction

from core.models import log_action
from tasks.models import Unit

from ..models import AnnotatorProfile
from ..utils import same_label


def _category_metrics(units) -> dict:
    counts = {}
    for unit in units:
        label = unit.human_label.get("label") if isinstance(unit.human_label, dict) else str(unit.human_label)
        counts[label] = counts.get(label, 0) + 1
    total = sum(counts.values()) or 1
    return {label: {"count": c, "share": round(c / total, 4)} for label, c in counts.items()}


@transaction.atomic
def rebuild_profiles(task_type=None, annotator=None, user=None) -> list:
    """依据已有 Unit 人工结果重建画像（准确率以 AI 一致率作为代理指标）。"""
    qs = Unit.objects.filter(human_reviewed=True, reviewed_by__isnull=False).select_related("task", "reviewed_by")
    if task_type:
        qs = qs.filter(task__task_type=task_type)
    if annotator is not None:
        qs = qs.filter(reviewed_by=annotator)

    grouped = {}
    for unit in qs:
        key = (unit.reviewed_by_id, unit.task.task_type)
        grouped.setdefault(key, []).append(unit)

    profiles = []
    for (annotator_id, tt), units in grouped.items():
        reviewed = [u for u in units if u.ai_prediction and u.human_label is not None]
        agree = sum(1 for u in reviewed if same_label(u.human_label, u.ai_prediction))
        accuracy = round(agree / len(reviewed), 4) if reviewed else 0.0
        profile, _ = AnnotatorProfile.objects.update_or_create(
            annotator_id=annotator_id,
            task_type=tt,
            defaults={
                "accuracy": accuracy,
                "total_reviewed": len(units),
                "category_metrics": _category_metrics(units),
            },
        )
        profiles.append(profile)

    log_action(user, "qc:profiles_rebuild", "task_type", task_type or "all", {"profiles": len(profiles)})
    return profiles
