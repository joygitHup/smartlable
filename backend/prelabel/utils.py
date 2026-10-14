"""prelabel 纯函数工具（不访问数据库）。"""
import re

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


def match_rule(pattern: str, rule_type: str, text: str) -> bool:
    """判断文本是否命中规则：keyword 子串匹配 / regex 正则匹配。"""
    if not pattern or text is None:
        return False
    if rule_type == "keyword":
        return pattern in text
    try:
        return re.search(pattern, text) is not None
    except re.error:
        return False


def find_spans(pattern: str, rule_type: str, text: str, limit: int = 20) -> list:
    """返回命中的 span 列表（供可解释性展示）。"""
    spans = []
    if not pattern or not text:
        return spans
    if rule_type == "keyword":
        start = 0
        while len(spans) < limit:
            idx = text.find(pattern, start)
            if idx == -1:
                break
            spans.append({"start": idx, "end": idx + len(pattern), "text": pattern})
            start = idx + len(pattern)
        return spans
    try:
        for m in re.finditer(pattern, text):
            spans.append({"start": m.start(), "end": m.end(), "text": m.group(0)})
            if len(spans) >= limit:
                break
    except re.error:
        return []
    return spans


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def same_label(a, b) -> bool:
    """按 JSON 语义比较两个标签结构是否一致。"""
    import json

    return json.dumps(a, ensure_ascii=False, sort_keys=True) == json.dumps(b, ensure_ascii=False, sort_keys=True)
