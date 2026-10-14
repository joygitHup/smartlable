"""llmops 列表查询参数过滤（纯函数）。"""


def filter_prompts(qs, params):
    task_type = params.get("task_type")
    if task_type:
        qs = qs.filter(task_type=task_type)
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    search = params.get("search")
    if search:
        qs = qs.filter(name__icontains=search)
    return qs


def filter_costs(qs, params):
    model = params.get("model")
    if model:
        qs = qs.filter(model=model)
    task = params.get("task") or params.get("task_id")
    if task:
        qs = qs.filter(task_id=task)
    unit = params.get("unit") or params.get("unit_id")
    if unit:
        qs = qs.filter(unit_id=unit)
    return qs


def filter_hallucinations(qs, params):
    unit = params.get("unit") or params.get("unit_id")
    if unit:
        qs = qs.filter(unit_id=unit)
    model = params.get("model")
    if model:
        qs = qs.filter(model=model)
    is_hallucination = params.get("is_hallucination")
    if is_hallucination is not None and is_hallucination != "":
        qs = qs.filter(is_hallucination=str(is_hallucination).lower() in ("1", "true", "yes"))
    return qs


def filter_consistency(qs, params):
    task = params.get("task") or params.get("task_id")
    if task:
        qs = qs.filter(task_id=task)
    model = params.get("model")
    if model:
        qs = qs.filter(model=model)
    return qs


def filter_distillations(qs, params):
    task_type = params.get("task_type")
    if task_type:
        qs = qs.filter(task_type=task_type)
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    return qs


def filter_rounds(qs, params):
    task = params.get("task") or params.get("task_id")
    if task:
        qs = qs.filter(task_id=task)
    unit = params.get("unit") or params.get("unit_id")
    if unit:
        qs = qs.filter(unit_id=unit)
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    return qs
