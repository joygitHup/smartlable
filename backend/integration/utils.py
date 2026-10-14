"""integration 工具函数（含真实 HTTP 调用封装）。"""
import json
import secrets
import urllib.error
import urllib.parse
import urllib.request

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


def gen_key(prefix: str = "ak") -> str:
    """生成开放 API key。"""
    return f"{prefix}_{secrets.token_hex(16)}"


def gen_secret() -> str:
    """生成开放 API secret。"""
    return secrets.token_hex(24)


def post_json(url: str, payload: dict, timeout: int = 5, headers: dict = None) -> dict:
    """真实向 url 发送 JSON POST，返回 {ok, status_code, body, error}。

    不伪造结果：网络/HTTP 失败时如实返回 ok=False，并附带错误原因。
    """
    if not url:
        return {"ok": False, "status_code": None, "body": "", "error": "url 为空"}
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    request = urllib.request.Request(url, data=data, method="POST", headers=req_headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return {"ok": 200 <= resp.status < 300, "status_code": resp.status, "body": body, "error": ""}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return {"ok": False, "status_code": exc.code, "body": body, "error": f"HTTP {exc.code}"}
    except Exception as exc:  # noqa: BLE001 - 网络异常需如实上报
        return {"ok": False, "status_code": None, "body": "", "error": str(exc)}


def get_json(url: str, params: dict = None, timeout: int = 5, headers: dict = None) -> dict:
    """真实向 url 发送 GET 并解析 JSON，返回 {ok, status_code, data, body, error}。

    不伪造结果：网络/HTTP/JSON 解析失败时如实返回 ok=False 并附带原因。
    """
    if not url:
        return {"ok": False, "status_code": None, "data": None, "body": "", "error": "url 为空"}
    if params:
        query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
        if query:
            url = f"{url}{'&' if '?' in url else '?'}{query}"
    req_headers = {"Accept": "application/json"}
    if headers:
        req_headers.update(headers)
    request = urllib.request.Request(url, method="GET", headers=req_headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            try:
                data = json.loads(body) if body else None
            except json.JSONDecodeError:
                return {
                    "ok": False,
                    "status_code": resp.status,
                    "data": None,
                    "body": body,
                    "error": "响应不是合法 JSON",
                }
            return {
                "ok": 200 <= resp.status < 300,
                "status_code": resp.status,
                "data": data,
                "body": body,
                "error": "",
            }
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return {"ok": False, "status_code": exc.code, "data": None, "body": body, "error": f"HTTP {exc.code}"}
    except Exception as exc:  # noqa: BLE001 - 网络异常需如实上报
        return {"ok": False, "status_code": None, "data": None, "body": "", "error": str(exc)}
