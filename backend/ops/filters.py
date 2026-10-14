"""ops 列表查询参数过滤（纯函数）。"""


def filter_comments(qs, params):
    task = params.get("task") or params.get("task_id")
    if task:
        qs = qs.filter(task_id=task)
    unit = params.get("unit") or params.get("unit_id")
    if unit:
        qs = qs.filter(unit_id=unit)
    author = params.get("author") or params.get("author_id")
    if author:
        qs = qs.filter(author_id=author)
    parent = params.get("parent") or params.get("parent_id")
    if parent:
        qs = qs.filter(parent_id=parent)
    return qs


def filter_announcements(qs, params):
    level = params.get("level")
    if level:
        qs = qs.filter(level=level)
    published = params.get("published")
    if published is not None and published != "":
        qs = qs.filter(published=str(published).lower() in ("1", "true", "yes"))
    return qs


def filter_notifications(qs, params):
    is_read = params.get("is_read")
    if is_read is not None and is_read != "":
        qs = qs.filter(is_read=str(is_read).lower() in ("1", "true", "yes"))
    category = params.get("category")
    if category:
        qs = qs.filter(category=category)
    return qs


def filter_reports(qs, params):
    report_type = params.get("report_type")
    if report_type:
        qs = qs.filter(report_type=report_type)
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    return qs


def filter_feedbacks(qs, params):
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    category = params.get("category")
    if category:
        qs = qs.filter(category=category)
    user = params.get("user") or params.get("user_id")
    if user:
        qs = qs.filter(user_id=user)
    return qs
