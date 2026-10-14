"""specs 列表查询参数过滤（纯函数）。"""


def filter_spec_documents(qs, params):
    task_type = params.get("task_type")
    if task_type:
        qs = qs.filter(task_type=task_type)
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    q = params.get("q")
    if q:
        qs = qs.filter(title__icontains=q)
    return qs


def filter_disputes(qs, params):
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    task = params.get("task") or params.get("task_id")
    if task:
        qs = qs.filter(task_id=task)
    return qs


def filter_quizzes(qs, params):
    task_type = params.get("task_type")
    if task_type:
        qs = qs.filter(task_type=task_type)
    difficulty = params.get("difficulty")
    if difficulty:
        qs = qs.filter(difficulty=difficulty)
    return qs
