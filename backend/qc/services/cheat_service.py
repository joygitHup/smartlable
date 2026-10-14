"""作弊检测服务(F11.2)：连续同标签 / 审核过快 / 照抄 AI。"""
import statistics

from django.db import transaction

from core.models import log_action
from tasks.models import Unit

from ..models import CheatDetection, CheatPatternType, CheatStatus
from ..utils import same_label

# 阈值：样本量与时间间隔
MIN_SAMPLE = 5
SAME_LABEL_RUN = 5
FAST_SECONDS = 5.0
COPY_PASTE_RATIO = 0.95


def _reviewed_by_annotator(task):
    units = Unit.objects.filter(task=task, human_reviewed=True).select_related("reviewed_by").order_by("reviewed_at", "id")
    grouped = {}
    for unit in units:
        if unit.reviewed_by_id is None:
            continue
        grouped.setdefault(unit.reviewed_by_id, []).append(unit)
    return grouped


def _longest_same_run(units) -> tuple:
    """返回最长连续同标签长度与其标签。"""
    longest, cur, cur_label, best_label = 0, 0, None, None
    for unit in units:
        key = str(unit.human_label.get("label")) if isinstance(unit.human_label, dict) else str(unit.human_label)
        if key == cur_label:
            cur += 1
        else:
            cur_label, cur = key, 1
        if cur > longest:
            longest, best_label = cur, cur_label
    return longest, best_label


def _median_interval(units):
    stamps = [u.reviewed_at for u in units if u.reviewed_at is not None]
    if len(stamps) < 2:
        return None
    intervals = [(stamps[i] - stamps[i - 1]).total_seconds() for i in range(1, len(stamps))]
    intervals = [i for i in intervals if i >= 0]
    if not intervals:
        return None
    return round(statistics.median(intervals), 2)


@transaction.atomic
def detect_cheating(task, user=None) -> list:
    """对单个任务跑作弊检测并落库，返回本次生成的检测记录。"""
    grouped = _reviewed_by_annotator(task)
    # 幂等：清理该任务下未处理的旧检测，避免重复累积
    CheatDetection.objects.filter(task=task, status=CheatStatus.OPEN).delete()

    created = []
    for annotator_id, units in grouped.items():
        total = len(units)
        if total < MIN_SAMPLE:
            continue

        run_len, run_label = _longest_same_run(units)
        if run_len >= SAME_LABEL_RUN:
            created.append(
                CheatDetection.objects.create(
                    task=task,
                    annotator_id=annotator_id,
                    pattern_type=CheatPatternType.SAME_LABEL,
                    evidence={"run_len": run_len, "label": run_label, "total": total},
                    score=round(run_len / total, 4),
                    status=CheatStatus.OPEN,
                )
            )

        median_interval = _median_interval(units)
        if median_interval is not None and median_interval < FAST_SECONDS:
            created.append(
                CheatDetection.objects.create(
                    task=task,
                    annotator_id=annotator_id,
                    pattern_type=CheatPatternType.TOO_FAST,
                    evidence={"median_interval_seconds": median_interval, "total": total},
                    score=round((FAST_SECONDS - median_interval) / FAST_SECONDS, 4),
                    status=CheatStatus.OPEN,
                )
            )

        copied = sum(
            1
            for u in units
            if u.ai_prediction and same_label(u.human_label, u.ai_prediction) and not u.modified_by_human
        )
        if total and copied / total >= COPY_PASTE_RATIO:
            created.append(
                CheatDetection.objects.create(
                    task=task,
                    annotator_id=annotator_id,
                    pattern_type=CheatPatternType.COPY_PASTE,
                    evidence={"copied": copied, "total": total},
                    score=round(copied / total, 4),
                    status=CheatStatus.OPEN,
                )
            )

    log_action(user, "qc:cheat_detect", "task", task.id,
               {"annotators": len(grouped), "detections": len(created)})
    return created
