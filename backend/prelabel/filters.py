"""prelabel 列表查询参数过滤（纯函数）。"""


def filter_class_thresholds(qs, params):
    task = params.get("task") or params.get("task_id")
    if task:
        qs = qs.filter(task_id=task)
    task_type = params.get("task_type")
    if task_type:
        qs = qs.filter(task_type=task_type)
    label = params.get("label")
    if label:
        qs = qs.filter(label=label)
    return qs


def filter_prelabel_records(qs, params):
    unit = params.get("unit") or params.get("unit_id")
    if unit:
        qs = qs.filter(unit_id=unit)
    task = params.get("task") or params.get("task_id")
    if task:
        qs = qs.filter(task_id=task)
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    return qs


def filter_rules(qs, params):
    task_type = params.get("task_type")
    if task_type:
        qs = qs.filter(task_type=task_type)
    enabled = params.get("enabled")
    if enabled is not None and enabled != "":
        qs = qs.filter(enabled=str(enabled).lower() in ("1", "true", "yes"))
    return qs


def filter_experiments(qs, params):
    task = params.get("task") or params.get("task_id")
    if task:
        qs = qs.filter(task_id=task)
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    return qs


def filter_long_tail_policies(qs, params):
    task_type = params.get("task_type")
    if task_type:
        qs = qs.filter(task_type=task_type)
    label = params.get("label")
    if label:
        qs = qs.filter(label=label)
    strategy = params.get("strategy")
    if strategy:
        qs = qs.filter(strategy=strategy)
    return qs
