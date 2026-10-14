"""specs 纯函数工具（不访问数据库）。"""
from django.utils import timezone

from common.exceptions import BusinessError


def now():
    return timezone.now()


def business_error(code, message=None, status_code=400):
    """构造带正确 HTTP 状态的 BusinessError。

    common.BusinessError 的 status_code 参数实际只作为 error code 传入，
    实例的 HTTP status 仍是默认 500；此处显式覆盖，保持错误码与 HTTP 状态一致。
    """
    exc = BusinessError(code, message, status_code=status_code)
    exc.status_code = status_code
    exc.detail = {"code": code, "message": exc.message}
    return exc


def to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def line_diff(old_text: str, new_text: str) -> dict:
    """按行做简单差异，返回新增/删除行数与内容，供规范变更影响分析使用。"""
    old_lines = (old_text or "").splitlines()
    new_lines = (new_text or "").splitlines()
    old_set = set(old_lines)
    new_set = set(new_lines)
    added = [ln for ln in new_lines if ln not in old_set]
    removed = [ln for ln in old_lines if ln not in new_set]
    return {
        "added": len(added),
        "removed": len(removed),
        "added_lines": added[:50],
        "removed_lines": removed[:50],
    }
