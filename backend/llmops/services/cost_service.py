"""LLM 成本服务(F15.2)：记录一次调用成本 + 按维度聚合汇总。"""
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Sum

from core.models import log_action

from ..models import LLMCostRecord


def estimate_cost(model, prompt_tokens=0, completion_tokens=0):
    """按 settings.LLM_TOKEN_PRICE 配置的单价估算成本。

    单价单位为「每千 token 价格」，格式如 {"glm-4-7-251222": {"input": 0.001, "output": 0.002}}；
    未配置该模型单价时返回 0（不臆造价格）。
    """
    price = (getattr(settings, "LLM_TOKEN_PRICE", {}) or {}).get(model)
    if not isinstance(price, dict):
        return 0
    in_price = float(price.get("input") or 0)
    out_price = float(price.get("output") or 0)
    return round(int(prompt_tokens or 0) / 1000 * in_price + int(completion_tokens or 0) / 1000 * out_price, 6)


@transaction.atomic
def record_cost(task=None, unit=None, model="", prompt_tokens=0, completion_tokens=0,
                total_tokens=None, cost=None, user=None) -> LLMCostRecord:
    """记录一次 LLM 调用成本；total_tokens 缺省时按 prompt+completion 计算，cost 缺省时按单价估算。"""
    prompt_tokens = prompt_tokens or 0
    completion_tokens = completion_tokens or 0
    if total_tokens in (None, ""):
        total_tokens = prompt_tokens + completion_tokens
    if cost in (None, ""):
        cost = estimate_cost(model, prompt_tokens, completion_tokens)
    record = LLMCostRecord.objects.create(
        task=task,
        unit=unit,
        model=model or "",
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens or 0,
        cost=cost or 0,
    )
    log_action(user, "llmops:cost_record", "llm_cost", record.id,
               {"model": record.model, "total_tokens": record.total_tokens, "cost": str(record.cost)})
    return record


@transaction.atomic
def record_costs_bulk(entries, user=None) -> int:
    """批量记录 LLM 调用成本(F15.2)，返回写入条数，避免批量预标注产生大量审计。

    entries: [{task, unit, model, prompt_tokens, completion_tokens, total_tokens?, cost?}]
    """
    records = []
    for e in entries or []:
        prompt = e.get("prompt_tokens") or 0
        completion = e.get("completion_tokens") or 0
        total = e.get("total_tokens")
        if total in (None, ""):
            total = prompt + completion
        cost = e.get("cost")
        if cost in (None, ""):
            cost = estimate_cost(e.get("model", ""), prompt, completion)
        records.append(
            LLMCostRecord(
                task=e.get("task"),
                unit=e.get("unit"),
                model=e.get("model") or "",
                prompt_tokens=prompt,
                completion_tokens=completion,
                total_tokens=total or 0,
                cost=cost or 0,
            )
        )
    if not records:
        return 0
    LLMCostRecord.objects.bulk_create(records)
    log_action(user, "llmops:cost_record_batch", "llm_cost", "", {"count": len(records)})
    return len(records)


def _num(value):
    return value if value is not None else 0


def summarize(start=None, end=None) -> dict:
    """按模型 / 任务聚合 token 与成本，支持 start/end 日期过滤。"""
    qs = LLMCostRecord.objects.all()
    if start:
        qs = qs.filter(created_at__date__gte=start)
    if end:
        qs = qs.filter(created_at__date__lte=end)

    by_model = list(
        qs.values("model")
        .annotate(
            calls=Count("id"),
            prompt_tokens=Sum("prompt_tokens"),
            completion_tokens=Sum("completion_tokens"),
            total_tokens=Sum("total_tokens"),
            cost=Sum("cost"),
        )
        .order_by("-total_tokens")
    )
    by_task = list(
        qs.values("task_id")
        .annotate(calls=Count("id"), total_tokens=Sum("total_tokens"), cost=Sum("cost"))
        .order_by("-total_tokens")
    )
    totals = qs.aggregate(calls=Count("id"), total_tokens=Sum("total_tokens"), cost=Sum("cost"))
    return {
        "total": {
            "calls": _num(totals.get("calls")),
            "total_tokens": _num(totals.get("total_tokens")),
            "cost": _num(totals.get("cost")),
        },
        "by_model": by_model,
        "by_task": by_task,
    }
