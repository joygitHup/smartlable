from django.db.models import Count
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from core.permissions import allow_roles
from tasks.models import Task, Unit, UnitStatus, SplitType, TaskStatus
from .models import ModelRecord, ModelStatus
from . import service

AI_MANAGE_ROLES = ("admin", "operator", "engineer")


# ---------- 批量预标注（真实 LLM + 阈值分流） ----------
@api_view(["POST"])
@permission_classes([allow_roles(*AI_MANAGE_ROLES)])
def run_ai(request, tid):
    try:
        task = Task.objects.get(id=tid)
    except Task.DoesNotExist:
        return Response({"error": "任务不存在"}, status=status.HTTP_404_NOT_FOUND)

    if task.ai_enabled:
        task.status = TaskStatus.PRELABELING
        task.save(update_fields=["status"])

    qs = Unit.objects.filter(task=task, status__in=[UnitStatus.CREATED, UnitStatus.PRELABELED]).order_by("id")
    units = list(qs)
    if not units:
        return Response({"success": True, "message": "没有待预标注样本", "processed": 0})

    threshold = task.confidence_threshold
    stat = {"processed": 0, "auto_approved": 0, "pending_review": 0, "failed": 0, "errors": []}

    for u in units:
        try:
            res = service.run_inference(task, u.content)
        except Exception as exc:  # noqa: BLE001 - 单条失败不阻断批量
            stat["failed"] += 1
            stat["errors"].append({"unit_id": u.id, "error": str(exc)[:200]})
            continue

        u.ai_prediction = res["prediction"]
        u.confidence = res["confidence"]
        u.ai_model = res["model"]
        stat["processed"] += 1

        # 阈值分流：高置信 → 自动通过；低置信 → 转人工审核
        if task.ai_enabled and res["confidence"] >= threshold:
            u.status = UnitStatus.AUTO_APPROVED
            stat["auto_approved"] += 1
        else:
            u.status = UnitStatus.PENDING_REVIEW
            stat["pending_review"] += 1
        u.save()

    # 有样本进入审核则切换任务状态
    if stat["processed"]:
        task.status = TaskStatus.REVIEWING
        task.save(update_fields=["status"])
    elif stat["failed"] and not stat["processed"]:
        # 全体推理失败（如实上报，不伪造 AI 结果）
        errs = "\n".join(f"样本#{e['unit_id']}: {e['error']}" for e in stat["errors"][:5])
        task.status = TaskStatus.CREATED
        task.save(update_fields=["status"])
        return Response(
            {
                "success": False,
                "message": "AI 预标注暂不可用（LLM 推理失败）",
                "errors": stat["errors"][:10],
                "detail_sample": errs,
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    request._request._audit_action = "task:run_ai"
    request._request._audit_target_type = "task"
    request._request._audit_target_id = task.id
    request._request._audit_detail = {
        "processed": stat["processed"],
        "auto_approved": stat["auto_approved"],
        "pending_review": stat["pending_review"],
        "failed": stat["failed"],
        "threshold": threshold,
        "model": task.ai_model,
    }
    return Response({"success": True, **stat})


# ---------- 数据回流（人工修正数据进入训练集） ----------
@api_view(["POST"])
@permission_classes([allow_roles(*AI_MANAGE_ROLES)])
def reflow(request, tid):
    try:
        task = Task.objects.get(id=tid)
    except Task.DoesNotExist:
        return Response({"error": "任务不存在"}, status=status.HTTP_404_NOT_FOUND)

    reviewed = Unit.objects.filter(task=task, status=UnitStatus.REVIEWED, human_reviewed=True)
    renamed = reviewed.filter(split=SplitType.NONE).update(split=SplitType.TRAIN)
    total_train = Unit.objects.filter(task=task, split=SplitType.TRAIN).count()

    # 记录一次回流版本快照
    from django.utils import timezone
    ModelRecord.objects.create(
        name=f"{task.name} 数据回流 {timezone.now():%m-%d %H:%M}",
        model_id=task.ai_model or "reflow-snapshot",
        task_type=task.task_type,
        description=f"从任务 #{task.id} 回流 {total_train} 条已审核数据进入训练集，触发模型微调候选。",
        metrics={"refund": total_train, "source": task.name},
        status=ModelStatus.DRAFT,
        created_by=request.user,
    )

    request._request._audit_action = "task:reflow"
    request._request._audit_target_type = "task"
    request._request._audit_target_id = task.id
    request._request._audit_detail = {"to_train": total_train, "newly": renamed}
    return Response({"success": True, "newly_renamed": renamed, "total_train": total_train})


# ---------- 模型记录 ----------
def model_payload(m: ModelRecord) -> dict:
    return {
        "id": m.id,
        "name": m.name,
        "model_id": m.model_id,
        "task_type": m.task_type,
        "description": m.description,
        "metrics": m.metrics,
        "status": m.status,
        "status_label": m.get_status_display(),
        "created_by": m.created_by.username if m.created_by else "",
        "created_at": m.created_at.isoformat(),
    }


@api_view(["GET", "POST"])
@permission_classes([allow_roles(*AI_MANAGE_ROLES)])
def models(request):
    if request.method == "GET":
        return Response([model_payload(m) for m in ModelRecord.objects.all()])
    data = request.data
    if not data.get("name") or not data.get("model_id"):
        return Response({"error": "缺少 name / model_id"}, status=status.HTTP_400_BAD_REQUEST)
    m = ModelRecord.objects.create(
        name=data["name"],
        model_id=data["model_id"],
        task_type=data.get("task_type", "classification"),
        description=data.get("description", ""),
        metrics=data.get("metrics", {}),
        status=data.get("status", ModelStatus.DRAFT),
        created_by=request.user,
    )
    request._request._audit_action = "ml:create"
    request._request._audit_target_type = "model"
    request._request._audit_target_id = m.id
    return Response(model_payload(m), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([allow_roles(*AI_MANAGE_ROLES)])
def model_detail(request, mid):
    try:
        m = ModelRecord.objects.get(id=mid)
    except ModelRecord.DoesNotExist:
        return Response({"error": "模型不存在"}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "PATCH":
        for f in ("name", "model_id", "description", "metrics", "status", "task_type"):
            if f in request.data:
                setattr(m, f, request.data[f])
        m.save()
        return Response(model_payload(m))
    m.delete()
    return Response({"success": True})


# ---------- 模型效果对比（新旧在验证集对比） ----------
@api_view(["POST"])
@permission_classes([allow_roles(*AI_MANAGE_ROLES)])
def compare(request):
    """接受两个模型指标，按 F1/准确率给出推荐。"""
    a = request.data.get("model_a", {})
    b = request.data.get("model_b", {})
    score = lambda mm: float(mm.get("f1") or mm.get("accuracy") or 0)  # noqa: E731
    sa, sb = score(a), score(b)
    if sa == sb:
        rec = "持平"
    else:
        rec = (a.get("name", "模型A") if sa > sb else b.get("name", "模型B")) + "（验证集 F1 更高）"
    return Response({"model_a": a, "model_b": b, "recommend": rec})