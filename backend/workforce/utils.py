"""workforce 纯函数工具（不访问数据库）。"""
from django.db.models import Case, IntegerField, Value, When
from django.utils import timezone

from common.exceptions import BusinessError
from tasks.models import Priority

# 优先级排序权重：urgent 优先
PRIORITY_RANK = {
    Priority.URGENT: 0,
    Priority.HIGH: 1,
    Priority.NORMAL: 2,
    Priority.LOW: 3,
}


def now():
    return timezone.now()


def business_error(code, message=None, status_code=400):
    """构造带正确 HTTP 状态的 BusinessError（common.BusinessError 默认 HTTP 500）。"""
    exc = BusinessError(code, message, status_code=status_code)
    exc.status_code = status_code
    exc.detail = {"code": code, "message": exc.message}
    return exc


def to_int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def priority_rank_annotation():
    """生成按优先级排序的 Case/When 注解。"""
    return Case(
        *[When(priority=key, then=Value(rank)) for key, rank in PRIORITY_RANK.items()],
        default=Value(9),
        output_field=IntegerField(),
    )
