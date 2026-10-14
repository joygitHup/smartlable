"""ops 纯函数工具（不访问数据库）。"""
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


def mask_name(name) -> str:
    """用户名脱敏：保留首尾字符，中间以 * 替代。"""
    if not name:
        return ""
    if len(name) <= 2:
        return name[0] + "*"
    return name[0] + "*" * (len(name) - 2) + name[-1]
