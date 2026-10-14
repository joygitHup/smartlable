"""金标注入服务(F11.1)：把金标样本混入任务队列并记录注入关系。"""
from django.db import transaction

from core.models import log_action
from tasks.models import Unit, UnitStatus

from ..models import GoldInjection, GoldSample
from ..utils import now


@transaction.atomic
def inject_gold(task, samples, batch="", assigned_to=None, user=None) -> list:
    """为指定任务的队列注入金标样本：每条金标生成一个待审 Unit 并记录注入关系。"""
    injections = []
    for sample in samples:
        if not isinstance(sample, GoldSample):
            continue
        unit = Unit.objects.create(
            task=task,
            content=sample.content,
            status=UnitStatus.PENDING_REVIEW,
            ai_prediction={
                "source": "gold",
                "sample_id": sample.id,
                "expected_label": sample.expected_label,
            },
            confidence=1.0,
            ai_model="gold-injection",
        )
        injection = GoldInjection.objects.create(
            task=task,
            sample=sample,
            unit=unit,
            batch=batch or "",
            assigned_to=assigned_to,
            injected_at=now(),
        )
        injections.append(injection)
    log_action(user, "qc:gold_inject", "task", task.id,
               {"batch": batch, "count": len(injections), "sample_ids": [i.sample_id for i in injections]})
    return injections
