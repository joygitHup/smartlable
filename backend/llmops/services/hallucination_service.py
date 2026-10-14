"""LLM 幻觉检测服务(F15.3)：按真实规则检测预标注结果，禁止伪造。

规则（全部基于 unit 自身的预标注与任务规范，无外部调用）：
- 未产出预标注
- 置信度缺失 / 越界 / 低于任务阈值
- 分类类：预测标签不在 task.spec.labels 候选内
- 实体类：实体文本未出现在原文中
"""
from django.db import transaction

from core.models import log_action

from ..models import HallucinationCheck, HallucinationStatus

# 判定为「幻觉」的规则（编造类）；置信度类问题仅计入风险分
HALLUCINATION_RULES = {"no_prediction", "label_not_in_spec", "entity_not_in_text", "missing_entities"}
SEVERITY = {
    "no_prediction": 0.4,
    "label_not_in_spec": 0.6,
    "entity_not_in_text": 0.6,
    "missing_entities": 0.4,
    "invalid_confidence": 0.3,
    "missing_confidence": 0.2,
    "low_confidence": 0.2,
}


def _split_prediction(prediction):
    """归一化预标注结构，返回 (label, entities)。"""
    if isinstance(prediction, dict):
        return prediction.get("label"), prediction.get("entities")
    if isinstance(prediction, list):
        return None, prediction
    return None, None


def _evaluate(unit):
    """对单个 unit 执行规则检查，返回 (reasons, score)。"""
    task = unit.task
    spec = task.spec or {}
    labels = spec.get("labels") or []
    prediction = unit.ai_prediction
    label, entities = _split_prediction(prediction)
    reasons = []

    if not prediction:
        reasons.append({"rule": "no_prediction", "detail": "AI 预标注为空"})

    confidence = unit.confidence
    if confidence is None:
        reasons.append({"rule": "missing_confidence", "detail": "缺少置信度"})
    elif confidence < 0 or confidence > 1:
        reasons.append({"rule": "invalid_confidence", "detail": f"置信度越界: {confidence}"})
    elif confidence < (task.confidence_threshold or 0):
        reasons.append({"rule": "low_confidence", "detail": f"置信度低于阈值 {task.confidence_threshold}"})

    if task.task_type == "entity":
        if entities is None:
            reasons.append({"rule": "missing_entities", "detail": "未抽取到实体结构"})
        else:
            content = unit.content or ""
            for entity in entities:
                text = entity.get("text") if isinstance(entity, dict) else str(entity)
                if text and text not in content:
                    reasons.append({"rule": "entity_not_in_text", "detail": f"实体「{text}」未出现在原文"})
    elif label is not None and labels and label not in labels:
        reasons.append({"rule": "label_not_in_spec", "detail": f"预测标签「{label}」不在候选标签内"})

    score = 0.0
    for reason in reasons:
        score += SEVERITY.get(reason["rule"], 0.1)
    return reasons, round(min(score, 1.0), 4)


@transaction.atomic
def detect(unit, model: str = "", user=None) -> HallucinationCheck:
    """检测并落库幻觉结果。"""
    reasons, score = _evaluate(unit)
    is_hallucination = any(r["rule"] in HALLUCINATION_RULES for r in reasons)
    check = HallucinationCheck.objects.create(
        unit=unit,
        model=model or unit.ai_model or "",
        is_hallucination=is_hallucination,
        score=score,
        reasons=reasons,
        status=HallucinationStatus.FLAGGED if is_hallucination else HallucinationStatus.CLEAN,
    )
    log_action(user, "llmops:hallucination_detect", "unit", unit.id,
               {"is_hallucination": is_hallucination, "score": score, "reasons": [r["rule"] for r in reasons]})
    return check
