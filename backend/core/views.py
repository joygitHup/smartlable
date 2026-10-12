import json

from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import AuditLog, User, Role
from .permissions import allow_roles


@api_view(["GET"])
def health(request):
    return Response({"status": "ok", "service": "ai-annotate-backend"})


# ---------- 认证 ----------
@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get("username")
    password = request.data.get("password")
    if not username or not password:
        return Response({"error": "请输入用户名和密码"}, status=status.HTTP_400_BAD_REQUEST)
    user = authenticate(request, username=username, password=password)
    if not user:
        return Response({"error": "用户名或密码错误"}, status=status.HTTP_401_UNAUTHORIZED)
    if not user.is_active:
        return Response({"error": "账号已被禁用"}, status=status.HTTP_403_FORBIDDEN)
    token, _ = Token.objects.get_or_create(user=user)
    return Response(_user_payload(user, token))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response({"success": True})


@api_view(["GET"])
def me(request):
    return Response(_user_payload(request.user))


def _user_payload(user, token=None):
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name or user.username,
        "role": user.role,
        "role_label": user.role_label,
        "skills": user.skills or [],
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "token": token.key if token else None,
        "permissions": role_permissions(user.role),
    }


def role_permissions(role: str) -> list:
    matrix = {
        "admin": ["task:manage", "data:manage", "ai:manage", "review", "quality:manage", "ml:manage", "user:manage", "audit", "export"],
        "operator": ["task:manage", "data:manage", "ai:manage", "quality:manage", "export"],
        "annotator": ["review"],
        "engineer": ["ml:manage", "data:view", "ai:manage", "export"],
        "pm": ["task:view", "quality:view", "data:view"],
    }
    return matrix.get(role, [])


# ---------- 用户管理（仅 admin / operator） ----------
@api_view(["GET", "POST"])
@permission_classes([allow_roles("admin", "operator")])
def users(request):
    if request.method == "GET":
        qs = User.objects.all().order_by("id")
        keyword = request.query_params.get("q")
        if keyword:
            qs = qs.filter(username__icontains=keyword)
        return Response([_user_short(u) for u in qs])

    data = request.data
    username = data.get("username")
    if not username:
        return Response({"error": "缺少用户名"}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=username).exists():
        return Response({"error": "用户名已存在"}, status=status.HTTP_409_CONFLICT)
    password = data.get("password") or "annotate123"
    role = data.get("role", Role.ANNOTATOR)
    user = User.objects.create_user(
        username=username,
        password=password,
        role=role,
        display_name=data.get("display_name", username),
        skills=data.get("skills", []),
        max_load=data.get("max_load", 0),
        email=data.get("email", ""),
        is_active=bool(data.get("is_active", True)),
    )
    if request.user:
        request._request._audit_action = "user:create"
        request._request._audit_target_type = "user"
        request._request._audit_target_id = user.id
        request._request._audit_detail = {"username": username, "role": role}
    return Response(_user_short(user), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([allow_roles("admin")])
def user_detail(request, uid):
    try:
        user = User.objects.get(id=uid)
    except User.DoesNotExist:
        return Response({"error": "用户不存在"}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "PATCH":
        data = request.data
        for f in ("display_name", "role", "skills", "max_load", "is_active"):
            if f in data:
                setattr(user, f, data[f])
        if data.get("password"):
            user.set_password(data["password"])
        user.save()
        request._request._audit_action = "user:update"
        request._request._audit_target_type = "user"
        request._request._audit_target_id = user.id
        return Response(_user_short(user))
    user.delete()
    return Response({"success": True})


def _user_short(user):
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "role": user.role,
        "role_label": user.role_label,
        "skills": user.skills or [],
        "max_load": user.max_load,
        "is_active": user.is_active,
        "date_joined": user.date_joined.isoformat(),
    }


# ---------- 审计日志 ----------
@api_view(["GET"])
@permission_classes([allow_roles("admin", "operator")])
def audit_logs(request):
    qs = AuditLog.objects.select_related("user").all()[:200]
    return Response(
        [
            {
                "id": a.id,
                "user": a.user.username if a.user else "-",
                "action": a.action,
                "target_type": a.target_type,
                "target_id": a.target_id,
                "detail": a.detail,
                "created_at": a.created_at.isoformat(),
            }
            for a in qs
        ]
    )


# ---------- 概览仪表盘 ----------
@api_view(["GET"])
def dashboard(request):
    from tasks.models import Task, Unit

    tasks_total = Task.objects.count()
    status_counts = {}
    for u in Unit.objects.values("status"):
        status_counts[u["status"]] = status_counts.get(u["status"], 0) + 1
    units_pending = status_counts.get("pending_review", 0)

    ai_total = Unit.objects.exclude(ai_prediction__isnull=True).count()
    ai_auto = Unit.objects.filter(status="auto_approved").count()
    ai_pass_rate = round(ai_auto / ai_total * 100, 1) if ai_total else 0.0

    units_reviewed = Unit.objects.filter(human_reviewed=True).count()
    units_modified = Unit.objects.filter(modified_by_human=True).count()
    modify_rate = round(units_modified / units_reviewed * 100, 1) if units_reviewed else 0.0

    from ai.models import ModelRecord
    models = ModelRecord.objects.count()

    from datetime import timedelta
    from django.utils import timezone
    recent_logs = AuditLog.objects.filter(created_at__gte=timezone.now() - timedelta(hours=24)).count()

    return Response(
        {
            "tasks_total": tasks_total,
            "units_total": sum(status_counts.values()),
            "units_pending_review": units_pending,
            "status_counts": status_counts,
            "ai_pass_rate": ai_pass_rate,
            "ai_total": ai_total,
            "ai_auto": ai_auto,
            "modify_rate": modify_rate,
            "units_reviewed": units_reviewed,
            "units_modified": units_modified,
            "models_total": models,
            "recent_activity_24h": recent_logs,
        }
    )