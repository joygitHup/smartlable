"""健康检查端点（ready/live），供编排与负载均衡使用。"""
from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from .constants import ErrorCode
from .response import ok
from rest_framework.response import Response


def _check_database():
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return True
    except Exception:
        return False


@api_view(["GET"])
@permission_classes([AllowAny])
def ready(request):
    checks = {"database": _check_database()}
    healthy = all(checks.values())
    return Response(
        {
            "code": ErrorCode.OK if healthy else ErrorCode.SERVER_ERROR,
            "message": "ok" if healthy else "degraded",
            "data": {"checks": checks},
        },
        status=200 if healthy else 503,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def live(request):
    return ok({"status": "alive"})
