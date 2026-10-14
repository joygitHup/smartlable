"""统一响应封装（仅新模块使用）。"""
from rest_framework.response import Response

from .constants import ErrorCode


def ok(data=None, message="ok"):
    return Response({"code": ErrorCode.OK, "message": message, "data": data})


def fail(code, message, errors=None, status_code=400):
    payload = {"code": code, "message": message}
    if errors is not None:
        payload["errors"] = errors
    return Response(payload, status=status_code)
