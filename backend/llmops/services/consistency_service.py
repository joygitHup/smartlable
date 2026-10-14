"""人机一致性对比服务(F15.4)：统计 AI 预标注与人工结果的一致率。"""
from django.db import transaction

from core.models import log_action
from tasks.models import Unit

from ..models import ConsistencyReport
from ..utils import same_label


@transaction.atomic
def compare(task, model: str = "", user=None) -> ConsistencyReport:
    """对指定任务聚合真实 Unit 数据，计算一致率并落库。"""
    units = Unit.objects.filter(task=task, human_label__isnull=False).only("id", "ai_prediction", "human_label")
    evaluated = [u for u in units if u.ai_prediction]
    sample_size = len(evaluated)

    mismatches = []
    agreed = 0
    for unit in evaluated:
        if same_label(unit.human_label, unit.ai_prediction):
            agreed += 1
        elif len(mismatches) < 50:
            mismatches.append(
                {"unit_id": unit.id, "ai_prediction": unit.ai_prediction, "human_label": unit.human_label}
            )

    agreement_rate = round(agreed / sample_size, 4) if sample_size else 0.0
    report = ConsistencyReport.objects.create(
        task=task,
        model=model or "",
        agreement_rate=agreement_rate,
        sample_size=sample_size,
        details={"agreed": agreed, "mismatch_count": sample_size - agreed, "mismatches": mismatches},
    )
    log_action(user, "llmops:consistency_compare", "task", task.id,
               {"agreement_rate": agreement_rate, "sample_size": sample_size})
    return report
