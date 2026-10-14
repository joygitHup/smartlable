"""workforce 列表查询参数过滤（纯函数）。"""


def filter_queue_entries(qs, params):
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    priority = params.get("priority")
    if priority:
        qs = qs.filter(priority=priority)
    task = params.get("task") or params.get("task_id")
    if task:
        qs = qs.filter(task_id=task)
    return qs


def filter_assignments(qs, params):
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    task = params.get("task") or params.get("task_id")
    if task:
        qs = qs.filter(task_id=task)
    assignee = params.get("assignee") or params.get("assignee_id")
    if assignee:
        qs = qs.filter(assignee_id=assignee)
    return qs


def filter_worklogs(qs, params):
    task = params.get("task") or params.get("task_id")
    if task:
        qs = qs.filter(task_id=task)
    assignee = params.get("assignee") or params.get("assignee_id")
    if assignee:
        qs = qs.filter(assignee_id=assignee)
    return qs


def filter_estimates(qs, params):
    task = params.get("task") or params.get("task_id")
    if task:
        qs = qs.filter(task_id=task)
    return qs


def filter_skill_tags(qs, params):
    task_type = params.get("task_type")
    if task_type:
        qs = qs.filter(task_type=task_type)
    category = params.get("category")
    if category:
        qs = qs.filter(category=category)
    return qs
