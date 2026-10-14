"""compliance 纯函数工具（不访问数据库）。"""
import hashlib
import uuid
from datetime import datetime, time

from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

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


def gen_token() -> str:
    """生成溯源码。"""
    return uuid.uuid4().hex


def content_hash(*parts) -> str:
    """对给定片段生成内容指纹（sha256）。"""
    raw = "|".join(str(p) for p in parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def parse_dt(value):
    """解析时间参数为 aware datetime（支持日期或日期时间）。"""
    if not value:
        return None
    dt = parse_datetime(value)
    if dt is None:
        d = parse_date(value)
        if d is None:
            return None
        dt = datetime.combine(d, time.min)
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt
