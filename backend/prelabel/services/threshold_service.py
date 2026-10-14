"""类别阈值动态调优服务(F10.2)：基于人工修正率给出建议阈值。"""
from django.conf import settings
from django.db import transaction

from core.models import log_action
from tasks.models import Task, Unit

from ..models import ClassThreshold
from ..utils import clamp, same_label


def _label_key(prediction) -> str:
    if isinstance(prediction, dict):
        return str(prediction.get("label") or "")
    return ""


def label_of(prediction) -> str:
    """从预测结果中提取类别标签（供分流阈值解析复用）。"""
    return _label_key(prediction)


def resolve_threshold(task, label) -> float:
    """解析分流阈值(F10.1)：任务级类别阈值 > 任务类型级类别阈值 > 任务默认阈值。

    不同类别准确率不同，不能一刀切；未配置类别阈值时回退任务默认阈值。
    """
    label = str(label or "")
    if label:
        th = ClassThreshold.objects.filter(task=task, label=label).first()
        if th is None:
            th = ClassThreshold.objects.filter(task__isnull=True, task_type=task.task_type, label=label).first()
        if th is not None:
            return clamp(float(th.threshold), 0.0, 1.0)
    return float(task.confidence_threshold)


def resolve_threshold_for_prediction(task, prediction) -> float:
    """按预测标签解析分流阈值(F10.1)。"""
    return resolve_threshold(task, label_of(prediction))


def _collect_label_stats(task_type, task=None):
    """统计某任务类型下，各类别的 A I标签修正情况。"""
    qs = Unit.objects.filter(task__task_type=task_type)
    if task is not None:
        qs = qs.filter(task=task)
    stats = {}
    for unit in qs:
        label = _label_key(unit.ai_prediction)
        if not label:
            continue
        bucket = stats.setdefault(label, {"reviewed": 0, "corrected": 0})
        if unit.human_reviewed and unit.human_label is not None:
            bucket["reviewed"] += 1
            if not same_label(unit.ai_prediction, unit.human_label):
                bucket["corrected"] += 1
    return stats


def suggest_threshold(correction_rate, sample_size, base_threshold, min_sample=20):
    """调优公式：修正率越高 → 阈值越高（更保守，减少自动通过）。

    sample_size 不足时保持基础阈值，不建议生效。
    """
    if sample_size < min_sample:
        return base_threshold, "样本量不足，保持基础阈值", False
    suggested = clamp(base_threshold + (correction_rate - 0.05) * 0.5, 0.5, 0.99)
    reason = (
        f"人工修正率 {correction_rate:.2%}（样本 {sample_size}），"
        f"按 base + (修正率-5%)×0.5 推算，建议阈值 {suggested:.3f}"
    )
    return round(suggested, 3), reason, True


@transaction.atomic
def tune_thresholds(task=None, task_type=None, user=None, write_back=True):
    """对某任务/任务类型下的类别阈值做动态调优，返回建议值与依据。"""
    if task is not None:
        task_type = task.task_type
    stats = _collect_label_stats(task_type, task)

    thresholds = ClassThreshold.objects.filter(task_type=task_type)
    if task is not None:
        thresholds = thresholds.filter(task=task)
    thresholds = list(thresholds)

    # 无阈值记录时，依据已有标签自动生成待调优条目
    existing_labels = {t.label for t in thresholds}
    for label in stats:
        if label not in existing_labels:
            created = ClassThreshold.objects.create(
                task=task, task_type=task_type, label=label, threshold=settings.DEFAULT_CONFIDENCE_THRESHOLD
            )
            thresholds.append(created)

    base_default = settings.DEFAULT_CONFIDENCE_THRESHOLD
    suggestions = []
    for th in thresholds:
        stat = stats.get(th.label, {"reviewed": 0, "corrected": 0})
        reviewed = stat["reviewed"]
        rate = stat["corrected"] / reviewed if reviewed else 0.0
        base = th.threshold or base_default
        suggested, reason, effective = suggest_threshold(rate, reviewed, base)

        th.human_correction_rate = round(rate, 4)
        th.sample_size = reviewed
        update_fields = ["human_correction_rate", "sample_size", "updated_at"]
        applied = False
        if effective and write_back:
            th.threshold = suggested
            th.auto_tuned = True
            update_fields += ["threshold", "auto_tuned"]
            applied = True
        th.save(update_fields=update_fields)

        suggestions.append(
            {
                "threshold_id": th.id,
                "label": th.label,
                "current_threshold": base,
                "suggested_threshold": suggested,
                "correction_rate": th.human_correction_rate,
                "sample_size": reviewed,
                "basis": reason,
                "applied": applied,
            }
        )

    log_action(user, "prelabel:tune_thresholds", "task" if task else "task_type",
               task.id if task else task_type, {"count": len(suggestions)})
    return {"task_type": task_type, "task_id": task.id if task else None, "suggestions": suggestions}
