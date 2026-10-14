"""预标注动作服务：可解释、多模型对比、失败降级、规则兜底(F10.3~F10.6)。"""
from django.db import transaction

from common.constants import ErrorCode
from core.models import log_action
from tasks.models import Unit, UnitStatus

from ..constants import PrelabelErrorCode, PRELABEL_ERROR_MESSAGE
from ..models import PrelabelRecord, PrelabelRecordStatus, PrelabelRule
from ..utils import business_error, find_spans, match_rule, same_label


def _err(code, status_code=400, message=None):
    return business_error(code, message or PRELABEL_ERROR_MESSAGE.get(code), status_code=status_code)


def get_unit(unit_id) -> Unit:
    if not unit_id:
        raise _err(PrelabelErrorCode.UNIT_REQUIRED, status_code=400)
    try:
        return Unit.objects.select_related("task").get(id=unit_id)
    except Unit.DoesNotExist:
        raise _err(PrelabelErrorCode.UNIT_NOT_FOUND, status_code=404)


def explain_unit(unit: Unit) -> dict:
    """返回该 unit 的可解释信息：规则命中 span + 最近一次预标注记录(F10.3)。"""
    task_type = unit.task.task_type if unit.task_id else ""
    rule_matches = []
    for rule in PrelabelRule.objects.filter(task_type=task_type, enabled=True).order_by("-priority", "id"):
        spans = find_spans(rule.pattern, rule.rule_type, unit.content)
        if spans:
            rule_matches.append(
                {
                    "rule_id": rule.id,
                    "rule_name": rule.name,
                    "rule_type": rule.rule_type,
                    "label": rule.label,
                    "pattern": rule.pattern,
                    "spans": spans,
                }
            )
    record = PrelabelRecord.objects.filter(unit=unit).order_by("-created_at").first()
    return {
        "unit_id": unit.id,
        "task_id": unit.task_id,
        "task_type": task_type,
        "content": unit.content,
        "ai_prediction": unit.ai_prediction,
        "confidence": unit.confidence,
        "ai_model": unit.ai_model,
        "status": unit.status,
        "rule_matches": rule_matches,
        "explanation": record.explanation if record else {},
        "candidates": record.candidates if record else [],
        "chosen_model": record.chosen_model if record else "",
        "record_id": record.id if record else None,
    }


def _agreement(candidates) -> bool:
    if len(candidates) < 2:
        return True
    first = candidates[0].get("prediction")
    return all(same_label(c.get("prediction"), first) for c in candidates[1:])


@transaction.atomic
def compare_models(unit: Unit, provided_candidates=None, user=None) -> dict:
    """多模型结果对比(F10.5)：收集候选并落库。

    未提供候选时 best-effort 调用真实模型（失败如实抛 503），不伪造结果。
    """
    candidates = list(provided_candidates or [])
    if not candidates:
        from ai import service as ai_service  # 延迟导入，复用现有 LLM 调用

        try:
            result = ai_service.run_inference(unit.task, unit.content)
        except Exception as exc:  # noqa: BLE001 - 外部服务失败统一转业务异常
            raise _err(ErrorCode.EXTERNAL_ERROR, status_code=503, message=f"模型推理失败：{exc}")
        candidates.append(
            {
                "model": result.get("model"),
                "prediction": result.get("prediction"),
                "confidence": result.get("confidence"),
            }
        )

    chosen = max(candidates, key=lambda c: c.get("confidence") or 0.0)
    record = PrelabelRecord.objects.create(
        unit=unit,
        task=unit.task,
        candidates=candidates,
        chosen_model=chosen.get("model", ""),
        explanation={"type": "multi_model_compare", "count": len(candidates), "agreement": _agreement(candidates)},
        status=PrelabelRecordStatus.SUCCESS,
    )
    log_action(user, "prelabel:compare", "unit", unit.id, {"candidates": len(candidates)})
    return {
        "record_id": record.id,
        "unit_id": unit.id,
        "candidates": candidates,
        "chosen_model": chosen.get("model", ""),
        "agreement": _agreement(candidates),
    }


@transaction.atomic
def record_prelabel(unit: Unit, task, result: dict, user=None) -> PrelabelRecord:
    """记录一次正常 LLM 预标注结果(F10.2/F10.3)：承载候选与可解释信息。

    由批量预标注(run-ai)等常规链路调用，使预标注记录不再只由降级路径产生。
    """
    record = PrelabelRecord.objects.create(
        unit=unit,
        task=task,
        candidates=[
            {
                "model": result.get("model"),
                "prediction": result.get("prediction"),
                "confidence": result.get("confidence"),
            }
        ],
        chosen_model=result.get("model") or "",
        explanation={"type": "llm_inference", "confidence": result.get("confidence")},
        status=PrelabelRecordStatus.SUCCESS,
    )
    return record


@transaction.atomic
def record_failed(unit: Unit, task, reason: str, user=None) -> PrelabelRecord:
    """记录一次预标注失败(F10.4)：如实落库失败原因，供溯源与降级分析。"""
    record = PrelabelRecord.objects.create(
        unit=unit,
        task=task,
        candidates=[],
        chosen_model="",
        explanation={"type": "failed"},
        status=PrelabelRecordStatus.FAILED,
        fallback_reason=(reason or "AI 预标注失败")[:255],
    )
    log_action(user, "prelabel:failed", "unit", unit.id, {"reason": record.fallback_reason})
    return record


@transaction.atomic
def fallback_unit(unit: Unit, reason: str, user=None) -> PrelabelRecord:
    """预标注失败降级(F10.4)：转为待人工审核并记录降级原因。"""
    reason = reason or "AI 预标注失败，降级人工审核"
    unit.status = UnitStatus.PENDING_REVIEW
    unit.save(update_fields=["status"])
    record = PrelabelRecord.objects.create(
        unit=unit,
        task=unit.task,
        candidates=[],
        chosen_model="",
        explanation={"type": "fallback"},
        status=PrelabelRecordStatus.FALLBACK,
        fallback_reason=reason,
    )
    log_action(user, "prelabel:fallback", "unit", unit.id, {"reason": reason})
    return record


@transaction.atomic
def apply_rules(unit: Unit, user=None) -> dict:
    """规则引擎兜底(F10.6)：按优先级匹配，命中则直接给 label。"""
    task_type = unit.task.task_type if unit.task_id else ""
    rules = PrelabelRule.objects.filter(task_type=task_type, enabled=True).order_by("-priority", "id")
    for rule in rules:
        if match_rule(rule.pattern, rule.rule_type, unit.content):
            spans = find_spans(rule.pattern, rule.rule_type, unit.content)
            unit.ai_prediction = {"label": rule.label, "source": "rule", "rule_id": rule.id}
            unit.confidence = 1.0
            unit.ai_model = "rule-engine"
            unit.status = UnitStatus.PRELABELED
            unit.save(update_fields=["ai_prediction", "confidence", "ai_model", "status"])
            record = PrelabelRecord.objects.create(
                unit=unit,
                task=unit.task,
                candidates=[{"model": "rule-engine", "prediction": {"label": rule.label}, "confidence": 1.0}],
                chosen_model="rule-engine",
                explanation={
                    "type": "rule_hit",
                    "rule_id": rule.id,
                    "rule_name": rule.name,
                    "pattern": rule.pattern,
                    "spans": spans,
                },
                status=PrelabelRecordStatus.SUCCESS,
            )
            log_action(user, "prelabel:apply_rules", "unit", unit.id, {"rule_id": rule.id, "label": rule.label})
            return {
                "hit": True,
                "unit_id": unit.id,
                "label": rule.label,
                "rule_id": rule.id,
                "record_id": record.id,
                "spans": spans,
            }
    return {"hit": False, "unit_id": unit.id, "reason": PRELABEL_ERROR_MESSAGE[PrelabelErrorCode.NO_RULE_HIT]}
