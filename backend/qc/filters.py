"""qc 列表查询参数过滤（纯函数）。"""


def filter_gold_samples(qs, params):
    task = params.get("task") or params.get("task_id")
    if task:
        qs = qs.filter(task_id=task)
    active = params.get("active")
    if active is not None and active != "":
        qs = qs.filter(active=str(active).lower() in ("1", "true", "yes"))
    return qs


def filter_cheat_detections(qs, params):
    task = params.get("task") or params.get("task_id")
    if task:
        qs = qs.filter(task_id=task)
    annotator = params.get("annotator") or params.get("annotator_id")
    if annotator:
        qs = qs.filter(annotator_id=annotator)
    pattern_type = params.get("pattern_type")
    if pattern_type:
        qs = qs.filter(pattern_type=pattern_type)
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    return qs


def filter_cross_reviews(qs, params):
    unit = params.get("unit") or params.get("unit_id")
    if unit:
        qs = qs.filter(unit_id=unit)
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    agreed = params.get("agreed")
    if agreed is not None and agreed != "":
        qs = qs.filter(agreed=str(agreed).lower() in ("1", "true", "yes"))
    return qs


def filter_profiles(qs, params):
    annotator = params.get("annotator") or params.get("annotator_id")
    if annotator:
        qs = qs.filter(annotator_id=annotator)
    task_type = params.get("task_type")
    if task_type:
        qs = qs.filter(task_type=task_type)
    return qs


def filter_trends(qs, params):
    annotator = params.get("annotator") or params.get("annotator_id")
    if annotator:
        qs = qs.filter(annotator_id=annotator)
    task = params.get("task") or params.get("task_id")
    if task:
        qs = qs.filter(task_id=task)
    return qs


def filter_reworks(qs, params):
    task = params.get("task") or params.get("task_id")
    if task:
        qs = qs.filter(task_id=task)
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    assigned_to = params.get("assigned_to")
    if assigned_to:
        qs = qs.filter(assigned_to_id=assigned_to)
    return qs


def filter_appeals(qs, params):
    annotator = params.get("annotator") or params.get("annotator_id")
    if annotator:
        qs = qs.filter(annotator_id=annotator)
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    return qs
