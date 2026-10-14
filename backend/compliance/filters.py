"""compliance 列表查询参数过滤（纯函数）。"""
from .utils import parse_dt


def filter_classifications(qs, params):
    level = params.get("level")
    if level:
        qs = qs.filter(level=level)
    return qs


def filter_policies(qs, params):
    task_type = params.get("task_type")
    if task_type:
        qs = qs.filter(task_type=task_type)
    level = params.get("level")
    if level:
        qs = qs.filter(level=level)
    return qs


def filter_watermarks(qs, params):
    target_type = params.get("target_type")
    if target_type:
        qs = qs.filter(target_type=target_type)
    target_id = params.get("target_id")
    if target_id:
        qs = qs.filter(target_id=target_id)
    return qs


def filter_environments(qs, params):
    level = params.get("level")
    if level:
        qs = qs.filter(level=level)
    enabled = params.get("enabled")
    if enabled is not None and enabled != "":
        qs = qs.filter(enabled=str(enabled).lower() in ("1", "true", "yes"))
    return qs


def filter_lifecycle_policies(qs, params):
    level = params.get("level")
    if level:
        qs = qs.filter(level=level)
    action = params.get("action")
    if action:
        qs = qs.filter(action=action)
    enabled = params.get("enabled")
    if enabled is not None and enabled != "":
        qs = qs.filter(enabled=str(enabled).lower() in ("1", "true", "yes"))
    return qs


def filter_checklists(qs, params):
    framework = params.get("framework")
    if framework:
        qs = qs.filter(framework=framework)
    required = params.get("required")
    if required is not None and required != "":
        qs = qs.filter(required=str(required).lower() in ("1", "true", "yes"))
    return qs


def filter_checks(qs, params):
    checklist = params.get("checklist") or params.get("checklist_id")
    if checklist:
        qs = qs.filter(checklist_id=checklist)
    status = params.get("status")
    if status:
        qs = qs.filter(status=status)
    return qs


def filter_audit_logs(qs, params):
    user = params.get("user") or params.get("user_id")
    if user:
        qs = qs.filter(user_id=user)
    action = params.get("action")
    if action:
        qs = qs.filter(action=action)
    target_type = params.get("target_type")
    if target_type:
        qs = qs.filter(target_type=target_type)
    start = parse_dt(params.get("start"))
    if start:
        qs = qs.filter(created_at__gte=start)
    end = parse_dt(params.get("end"))
    if end:
        qs = qs.filter(created_at__lte=end)
    return qs
