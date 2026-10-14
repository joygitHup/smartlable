import csv
import io
import json
import logging

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import AuditLog, Role
from core.permissions import allow_roles
from .models import Task, Unit, UnitStatus, SplitType, TaskStatus

logger = logging.getLogger("ai_annotate.tasks")

MANAGE_ROLES = ("admin", "operator")
REVIEW_ROLES = ("admin", "annotator", "engineer")
PENDING_UNIT_STATUSES = (UnitStatus.CREATED, UnitStatus.PRELABELED, UnitStatus.PENDING_REVIEW)


# ---------- 序列化 ----------
def task_payload(t: Task) -> dict:
    stats = {}
    counts = dict(Unit.objects.filter(task=t).values_list("status").annotate(c=Count("id")))
    stats["total"] = sum(counts.values())
    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "task_type": t.task_type,
        "task_type_label": t.get_task_type_display(),
        "modality": t.modality,
        "spec": t.spec or {},
        "ai_enabled": t.ai_enabled,
        "confidence_threshold": t.confidence_threshold,
        "manual_review_ratio": t.manual_review_ratio,
        "ai_model": t.ai_model,
        "priority": t.priority,
        "status": t.status,
        "status_label": t.get_status_display(),
        "created_by": t.created_by.username if t.created_by else "",
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
        "units_total": stats["total"],
        "units_status": {k: v for k, v in counts.items()},
    }


def unit_payload(u: Unit) -> dict:
    return {
        "id": u.id,
        "task_id": u.task_id,
        "content": u.content,
        "status": u.status,
        "status_label": u.get_status_display(),
        "split": u.split,
        "ai_prediction": u.ai_prediction or {},
        "confidence": u.confidence,
        "ai_model": u.ai_model,
        "human_label": u.human_label,
        "human_reviewed": u.human_reviewed,
        "modified_by_human": u.modified_by_human,
        "review_reason": u.review_reason,
        "reviewed_by": u.reviewed_by.username if u.reviewed_by else "",
        "reviewed_at": u.reviewed_at.isoformat() if u.reviewed_at else None,
    }


# ---------- 任务 CRUD ----------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def tasks(request):
    if request.method == "GET":
        user = request.user
        qs = Task.objects.select_related("created_by")
        # 标注员/工程师/PM 仅可见在审任务（MVP：全部可见，前端的角色决定操作）
        if user.role == Role.PM:
            qs = qs.exclude(status=TaskStatus.ARCHIVED)
        q = request.query_params.get("q")
        if q:
            qs = qs.filter(name__icontains=q)
        st = request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)
        return Response([task_payload(t) for t in qs])

    # POST: 创建任务
    if request.user.role not in ("admin", "operator"):
        return Response({"error": "无权限创建任务"}, status=status.HTTP_403_FORBIDDEN)
    data = request.data
    if not data.get("name"):
        return Response({"error": "缺少任务名称"}, status=status.HTTP_400_BAD_REQUEST)
    t = Task.objects.create(
        name=data["name"],
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
        created_by=request.user,
    )
    request._request._audit_action = "task:create"
    request._request._audit_target_type = "task"
    request._request._audit_target_id = t.id
    request._request._audit_detail = {"name": t.name, "type": t.task_type}
    return Response(task_payload(t), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def task_detail(request, tid):
    try:
        t = Task.objects.get(id=tid)
    except Task.DoesNotExist:
        return Response({"error": "任务不存在"}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "GET":
        payload = task_payload(t)
        payload["recent_units"] = [
            unit_payload(u)
            for u in Unit.objects.filter(task=t).order_by("-id")[:5]
        ]
        return Response(payload)
    if request.user.role not in MANAGE_ROLES:
        return Response({"error": "无权限"}, status=status.HTTP_403_FORBIDDEN)
    if request.method == "PATCH":
        for f in ("name", "description", "spec", "confidence_threshold", "manual_review_ratio", "ai_enabled", "ai_model", "priority", "status"):
            if f in request.data:
                setattr(t, f, request.data[f])
        t.save()
        request._request._audit_action = "task:update"
        request._request._audit_target_type = "task"
        request._request._audit_target_id = t.id
        return Response(task_payload(t))
    t.delete()
    request._request._audit_action = "task:delete"
    request._request._audit_target_type = "task"
    request._request._audit_target_id = tid
    return Response({"success": True})


# ---------- 数据导入 ----------
@api_view(["POST"])
@permission_classes([allow_roles(*MANAGE_ROLES)])
def import_data(request, tid):
    try:
        t = Task.objects.get(id=tid)
    except Task.DoesNotExist:
        return Response({"error": "任务不存在"}, status=status.HTTP_404_NOT_FOUND)

    items = _parse_import(request)
    if not items:
        return Response({"error": "未解析到有效数据"}, status=status.HTTP_400_BAD_REQUEST)

    created = 0
    for item in items:
        content = item.get("content", "").strip()
        if not content:
            continue
        # 简单去重
        if Unit.objects.filter(task=t, content=content).exists():
            continue
        u = Unit.objects.create(task=t, content=content, status=UnitStatus.CREATED, split=SplitType.NONE)
        created += 1
        # 若导入数据自带预标注结果（来自已有预训练模型/其它系统），按阈值分流
        ai_pred = item.get("ai_prediction")
        confidence = item.get("confidence")
        if ai_pred is not None and confidence is not None:
            _apply_ai_result(t, u, ai_pred, confidence, item.get("ai_model", "imported"))

    if created:
        t.status = TaskStatus.CREATED
        t.save(update_fields=["status"])

    request._request._audit_action = "task:import"
    request._request._audit_target_type = "task"
    request._request._audit_target_id = t.id
    request._request._audit_detail = {"created": created, "duplicated": len(items) - created}
    return Response({"success": True, "created": created, "received": len(items)})


def _apply_ai_result(task: Task, unit: Unit, prediction, confidence, model=""):
    """把一条 AI 预标注结果写入单元并按阈值分流（导入预标注 / AI 推理共用）。

    分流阈值优先取该预测类别的类别阈值(F10.1)，无配置时回退任务默认阈值。
    """
    confidence = max(0.0, min(1.0, float(confidence)))
    unit.ai_prediction = prediction
    unit.confidence = confidence
    unit.ai_model = model or unit.ai_model
    # 延迟导入：避免 tasks ↔ prelabel 应用间循环依赖
    from prelabel.services.threshold_service import resolve_threshold_for_prediction

    threshold = resolve_threshold_for_prediction(task, prediction)
    if task.ai_enabled and confidence >= threshold:
        unit.status = UnitStatus.AUTO_APPROVED
    else:
        unit.status = UnitStatus.PENDING_REVIEW
    unit.save()


def _parse_import(request) -> list:
    """解析导入内容：支持 JSON 数组 / multipart 文件(JSON/CSV) / form 文本列表。
    返回 [{content, ai_prediction?, confidence?}]
    """
    ctype = request.content_type or ""
    if "multipart" in ctype or "application/octet-stream" in ctype:
        f = request.FILES.get("file")
        if not f:
            return []
        raw = f.read().decode("utf-8-sig", errors="ignore")
        name = (f.name or "").lower()
        if name.endswith(".csv"):
            return _parse_csv(raw)
        return _parse_json(raw)
    data = request.data.get("items") if isinstance(request.data, dict) else None
    if data is None:
        data = request.data
    if isinstance(data, str):
        return [{"content": l} for l in data.splitlines() if l.strip()]
    if isinstance(data, dict) and "items" in data:
        data = data["items"]
    return _normalize_items(data or [])


def _normalize_items(data) -> list:
    out = []
    for it in data or []:
        if isinstance(it, str):
            out.append({"content": it})
        elif isinstance(it, dict) and it.get("content"):
            out.append(it)
    return out


def _parse_json(raw: str) -> list:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return [{"content": l} for l in raw.splitlines() if l.strip()]
    if isinstance(data, list):
        return _normalize_items(data)
    if isinstance(data, dict) and "items" in data:
        return _normalize_items(data["items"])
    return []


def _parse_csv(raw: str) -> list:
    reader = csv.reader(io.StringIO(raw))
    out = []
    for row in reader:
        if row and row[0].strip():
            out.append({"content": row[0].strip()})
    return out


# ---------- 降级：纯人工入队 ----------
@api_view(["POST"])
@permission_classes([allow_roles("admin", "operator")])
def to_review(request, tid):
    """LLM 暂不可用或需纯人工兜底时，把待处理样本直接转入人工审核队列。"""
    try:
        t = Task.objects.get(id=tid)
    except Task.DoesNotExist:
        return Response({"error": "任务不存在"}, status=status.HTTP_404_NOT_FOUND)
    moved = Unit.objects.filter(task=t, status=UnitStatus.CREATED).update(status=UnitStatus.PENDING_REVIEW)
    if moved:
        t.status = TaskStatus.REVIEWING
        t.save(update_fields=["status"])
    return Response({"success": True, "moved_to_review": moved})


# ---------- 工作台 / 队列 ----------
@api_view(["GET"])
def units(request, tid):
    try:
        t = Task.objects.get(id=tid)
    except Task.DoesNotExist:
        return Response({"error": "任务不存在"}, status=status.HTTP_404_NOT_FOUND)
    qs = Unit.objects.filter(task=t)
    st = request.query_params.get("status")
    if st:
        qs = qs.filter(status=st)
    split = request.query_params.get("split")
    if split:
        qs = qs.filter(split=split)
    q = request.query_params.get("q")
    if q:
        qs = qs.filter(content__icontains=q)
    page = int(request.query_params.get("page", 1))
    page_size = min(int(request.query_params.get("page_size", 20)), 100)
    ordered = qs.order_by("id")
    total = ordered.count()
    start = (page - 1) * page_size
    rows = ordered[start : start + page_size]
    return Response(
        {
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": [unit_payload(u) for u in rows],
        }
    )


@api_view(["GET"])
@permission_classes([allow_roles(*REVIEW_ROLES)])
def queue_next(request, tid):
    """主动学习优先：取置信度最低的待审核样本。"""
    qs = Unit.objects.filter(task_id=tid, status=UnitStatus.PENDING_REVIEW).order_by("confidence", "id")
    u = qs.first()
    if not u:
        # 若无待审核，取已预标注(尚未分流)且置信度 < 阈值兜底或预标注样本
        u = Unit.objects.filter(task_id=tid, status=UnitStatus.PRELABELED).order_by("confidence", "id").first()
    if not u:
        return Response({"no_pending": True, "message": "当前没有待审核样本"})
    return Response(unit_payload(u))


# ---------- 人工审核 ----------
@api_view(["POST"])
@permission_classes([allow_roles(*REVIEW_ROLES)])
def review_unit(request, uid):
    try:
        u = Unit.objects.get(id=uid)
    except Unit.DoesNotExist:
        return Response({"error": "样本不存在"}, status=status.HTTP_404_NOT_FOUND)

    action = request.data.get("action", "accept")  # accept | modify
    if action == "accept":
        u.human_label = u.ai_prediction
        u.modified_by_human = False
    elif action == "modify":
        label = request.data.get("label", u.ai_prediction)
        u.human_label = label
        u.modified_by_human = True
        u.review_reason = request.data.get("reason", "")
    else:
        return Response({"error": f"未知操作 {action}"}, status=status.HTTP_400_BAD_REQUEST)

    u.human_reviewed = True
    u.status = UnitStatus.REVIEWED
    u.reviewed_by = request.user
    u.reviewed_at = timezone.now()
    u.save()

    request._request._audit_action = "unit:review"
    request._request._audit_target_type = "unit"
    request._request._audit_target_id = u.id
    request._request._audit_detail = {"action": action, "task_id": u.task_id}
    _maybe_complete_task(u.task, request.user)
    return Response(unit_payload(u))


# ---------- 进度 ----------
@api_view(["GET"])
def progress(request, tid):
    try:
        t = Task.objects.get(id=tid)
    except Task.DoesNotExist:
        return Response({"error": "任务不存在"}, status=status.HTTP_404_NOT_FOUND)
    qs = Unit.objects.filter(task=t)
    total = qs.count()
    counts = dict(qs.values_list("status").annotate(c=Count("id")))
    reviewed = counts.get(UnitStatus.REVIEWED, 0)
    ai_total = qs.exclude(ai_prediction__isnull=True).count()
    ai_auto = counts.get(UnitStatus.AUTO_APPROVED, 0)
    return Response(
        {
            "total": total,
            "reviewed": reviewed,
            "pending_review": counts.get(UnitStatus.PENDING_REVIEW, 0),
            "auto_approved": ai_auto,
            "ai_prelabeled": counts.get(UnitStatus.PRELABELED, 0),
            "progress_percent": round(reviewed / total * 100, 1) if total else 0.0,
            "ai_pass_rate": round(ai_auto / ai_total * 100, 1) if ai_total else 0.0,
        }
    )


# ---------- 导出 ----------
@api_view(["POST"])
def export(request, tid):
    try:
        t = Task.objects.get(id=tid)
    except Task.DoesNotExist:
        return Response({"error": "任务不存在"}, status=status.HTTP_404_NOT_FOUND)
    # 分级访问策略强制校验(F12.1/F12.3)：按任务类型策略限制导出角色/安全环境
    denied = _check_export_policy(t, request.user)
    if denied:
        request._request._audit_action = "task:export_denied"
        request._request._audit_target_type = "task"
        request._request._audit_target_id = t.id
        request._request._audit_detail = {"reason": denied}
        return Response({"error": denied}, status=status.HTTP_403_FORBIDDEN)
    fmt = request.data.get("format", "json")
    qs = Unit.objects.filter(task=t)
    rows = [
        {
            "id": u.id,
            "content": u.content,
            "ai_prediction": u.ai_prediction,
            "confidence": u.confidence,
            "human_label": u.human_label,
            "status": u.status,
            "split": u.split,
        }
        for u in qs
    ]
    if fmt == "csv":
        import io as _io

        sio = _io.StringIO()
        writer = csv.writer(sio)
        writer.writerow(["id", "content", "ai_label", "confidence", "human_label", "status", "split"])
        for r in rows:
            writer.writerow(
                [
                    r["id"],
                    r["content"],
                    json.dumps(r["ai_prediction"], ensure_ascii=False),
                    r["confidence"] if r["confidence"] is not None else "",
                    json.dumps(r["human_label"], ensure_ascii=False) if r["human_label"] else "",
                    r["status"],
                    r["split"],
                ]
            )
        request._request._audit_action = "task:export"
        request._request._audit_target_type = "task"
        request._request._audit_target_id = t.id
        return Response({"filename": f"task_{t.id}.csv", "content": sio.getvalue()})
    request._request._audit_action = "task:export"
    request._request._audit_target_type = "task"
    request._request._audit_target_id = t.id
    return Response({"filename": f"task_{t.id}.json", "content": json.dumps(rows, ensure_ascii=False, indent=2)})


# ---------- 事件与完成度 ----------
# 数据级别严重度（用于在仅按任务类型配置策略时取最严格策略，F12.1）
DATA_LEVEL_SEVERITY = {"public": 0, "internal": 1, "confidential": 2, "secret": 3}


def _check_export_policy(task: Task, user) -> str:
    """按数据分级策略校验导出权限(F12.1/F12.3)，返回拒绝原因（允许时返回空串）。

    仅按任务类型配置策略时，取该任务类型下最严格级别的策略执行。
    """
    from compliance.models import DataClassPolicy, SecureEnvironment  # 延迟导入，避免应用间耦合

    policies = list(DataClassPolicy.objects.filter(task_type=task.task_type))
    if not policies:
        return ""
    policy = max(policies, key=lambda p: DATA_LEVEL_SEVERITY.get(p.level, 1))
    if user.role == Role.ADMIN:
        return ""

    allowed = policy.allowed_roles or []
    if allowed and user.role not in allowed:
        return f"数据级别「{policy.get_level_display()}」策略禁止角色「{user.role_label}」导出"
    if policy.require_secure_env and not SecureEnvironment.objects.filter(level=policy.level, enabled=True).exists():
        return f"数据级别「{policy.get_level_display()}」要求安全环境，当前无启用的对应安全环境"
    return ""


def _task_event_payload(task: Task) -> dict:
    """任务级事件的统一载荷，供 Webhook / 通知复用的纯数据。"""
    return {
        "task_id": task.id,
        "name": task.name,
        "task_type": task.task_type,
        "status": task.status,
    }


def _dispatch_webhook(event: str, payload: dict) -> None:
    """向订阅该事件的 Webhook 投递(F13.2)，best-effort：失败仅记日志，不阻断主流程。"""
    try:
        from integration.services import webhook_service  # 延迟导入

        webhook_service.dispatch(event, payload)
    except Exception:  # noqa: BLE001 - 事件投递失败不影响主流程
        logger.warning("webhook dispatch failed for event %s", event, exc_info=True)


def _dispatch_task_event(task: Task, event: str = "task.completed") -> None:
    """触发任务级事件：向订阅 Webhook 投递(F13.2) 并通知任务创建人(F14.2)。"""
    _dispatch_webhook(event, _task_event_payload(task))
    try:
        from ops.services import notification_service  # 延迟导入

        if task.created_by_id:
            notification_service.notify(
                recipients=task.created_by,
                title=f"任务已完成：{task.name}",
                content=f"任务 #{task.id}「{task.name}」已无待处理样本，标注流程结束。",
                category="task",
                ref_type="task",
                ref_id=task.id,
            )
    except Exception:  # noqa: BLE001 - 通知失败不影响主流程
        logger.warning("task completion notify failed for task %s", task.id, exc_info=True)


def _maybe_complete_task(task: Task, user=None) -> bool:
    """当任务下无待处理单元且已开始处理时，标记完成并触发事件(F13.2/F14.2)。

    返回是否本次完成；无单元或已有待处理单元则不动作。
    """
    if task.status in (TaskStatus.COMPLETED, TaskStatus.ARCHIVED):
        return False
    if not Unit.objects.filter(task=task).exists():
        return False
    if Unit.objects.filter(task=task, status__in=PENDING_UNIT_STATUSES).exists():
        return False
    task.status = TaskStatus.COMPLETED
    task.save(update_fields=["status"])
    logger.info("task.completed", extra={"task_id": task.id})
    _dispatch_task_event(task)
    return True