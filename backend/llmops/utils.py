"""llmops 纯函数工具（不访问数据库）。"""
import json

from django.utils import timezone

from common.exceptions import BusinessError


def now():
    return timezone.now()


def business_error(code, message=None, status_code=400):
    """构造带正确 HTTP 状态的 BusinessError（与 specs 保持一致）。"""
    exc = BusinessError(code, message, status_code=status_code)
    exc.status_code = status_code
    exc.detail = {"code": code, "message": exc.message}
    return exc


def to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def as_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return [value]


def same_label(a, b) -> bool:
    """按 JSON 语义比较两个标签结构是否一致。"""
    return json.dumps(a, ensure_ascii=False, sort_keys=True) == json.dumps(b, ensure_ascii=False, sort_keys=True)
