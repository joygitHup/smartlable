"""开放 API 鉴权入口(F13.1)：业务系统以 X-API-Key + scopes 调用，不依赖登录态。

独立于 DRF Token 登录：直接校验 integration.APIClient.key 与 scopes，
真实更新 last_used_at；缺失/无效 Key 返回 401，越权返回 403，均如实报错。
"""
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from tasks.models import Task, TaskStatus, Unit, UnitStatus

from ..constants import IntegrationErrorCode
from ..models import APIClient
from ..utils import business_error

# 开放 API 授权范围（映射表）
SCOPE_TASKS_WRITE = "tasks:write"
SCOPE_TASKS_READ = "tasks:read"


def _authenticate(request, required_scope: str) -> APIClient:
    """校验 X-API-Key 与所需 scope，返回命中的 APIClient；失败抛 BusinessError。"""
    key = request.headers.get("X-API-Key") or request.META.get("HTTP_X_API_KEY")
    if not key:
        raise business_error(IntegrationErrorCode.UNAUTHORIZED, "缺少 X-API-Key 请求头", status_code=401)
    client = APIClient.objects.filter(key=key, enabled=True).first()
    if client is None:
        raise business_error(IntegrationErrorCode.UNAUTHORIZED, "API Key 无效或已禁用", status_code=401)
    if required_scope not in (client.scopes or []):
        raise business_error(
            IntegrationErrorCode.SCOPE_FORBIDDEN, f"API Key 缺少授权范围 {required_scope}", status_code=403
        )
    client.last_used_at = timezone.now()
    client.save(update_fields=["last_used_at", "updated_at"])
    return client


class OpenAPITaskView(APIView):
    """POST /integration/open-api/tasks：开放 API 创建标注任务(F13.1)。"""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        client = _authenticate(request, SCOPE_TASKS_WRITE)
        data = request.data
        name = str(data.get("name") or "").strip()
        if not name:
            raise business_error(IntegrationErrorCode.MISSING_PARAM, "缺少任务名称 name", status_code=400)
        task = Task.objects.create(
            name=name,
            description=data.get("description", ""),
            task_type=data.get("task_type", "classification"),
            modality=data.get("modality", "text"),
            spec=data.get("spec", {}),
            ai_enabled=bool(data.get("ai_enabled", True)),
            confidence_threshold=float(data.get("confidence_threshold", 0.8)),
            manual_review_ratio=float(data.get("manual_review_ratio", 0.3)),
            ai_model=data.get("ai_model", ""),
            priority=data.get("priority", "normal"),
            status=TaskStatus.CREATED,
            created_by=client.created_by,
        )
        request._request._audit_action = "openapi:task_create"
        request._request._audit_target_type = "task"
        request._request._audit_target_id = task.id
        request._request._audit_detail = {"client": client.name}
        return Response(
            {"success": True, "task_id": task.id, "name": task.name}, status=status.HTTP_201_CREATED
        )


class OpenAPITaskResultView(APIView):
    """GET /integration/open-api/tasks/{tid}/results：读取任务已人工审核的结果(F13.1)。"""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, tid):
        client = _authenticate(request, SCOPE_TASKS_READ)
        task = Task.objects.filter(id=tid).first()
        if task is None:
            raise business_error(IntegrationErrorCode.TASK_NOT_FOUND, status_code=404)
        qs = Unit.objects.filter(task=task, human_reviewed=True).order_by("id")
        items = [
            {"unit_id": u.id, "content": u.content, "label": u.human_label, "status": u.status}
            for u in qs
        ]
        request._request._audit_action = "openapi:task_results"
        request._request._audit_target_type = "task"
        request._request._audit_target_id = task.id
        request._request._audit_detail = {"client": client.name, "count": len(items)}
        return Response({"success": True, "task_id": task.id, "count": len(items), "items": items})
