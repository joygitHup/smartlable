from django.db.models import Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from core.permissions import allow_roles
from tasks.models import Task, Unit, UnitStatus
from core.models import log_action

QUALITY_ROLES = ("admin", "operator", "engineer")


def _label_of(unit) -> tuple:
    """提取可比较的标签键：统一按 JSON 序列化后判断一致性。"""
    import json

    return json.dumps(unit.human_label, ensure_ascii=False, sort_keys=True)


def compute_quality(task: Task) -> dict:
    qs = Unit.objects.filter(task=task)
    total = qs.count()
    counts = dict(qs.values_list("status").annotate(c=Count("id")))
    reviewed_qs = qs.filter(human_reviewed=True)
    reviewed = reviewed_qs.count()
    modified = reviewed_qs.filter(modified_by_human=True).count()
    ai_total = qs.exclude(ai_prediction__isnull=True).count()
    auto = counts.get(UnitStatus.AUTO_APPROVED, 0)

    # 一致性：AI 结果 == 人工保真结果 的比例
    agree = 0
    comparable = 0
    import json as _json

    for u in reviewed_qs:
        ai = u.ai_prediction
        hu = u.human_label
        if ai is None or hu is None:
            continue
        comparable += 1
        if _json.dumps(ai, ensure_ascii=False, sort_keys=True) == _json.dumps(hu, ensure_ascii=False, sort_keys=True):
            agree += 1
    ai_agreement = round(agree / comparable * 100, 1) if comparable else 0.0
    modify_rate = round(modified / reviewed * 100, 1) if reviewed else 0.0
    ai_pass_rate = round(auto / ai_total * 100, 1) if ai_total else 0.0

    # 近似 Kappa：po=一致率, pe=随机一致(按标签边缘分布粗略)
    kappa = _approx_kappa(reviewed_qs)

    return {
        "total": total,
        "reviewed": reviewed,
        "pending_review": counts.get(UnitStatus.PENDING_REVIEW, 0),
        "auto_approved": auto,
        "ai_total": ai_total,
        "ai_pass_rate": ai_pass_rate,
        "ai_agreement": ai_agreement,
        "modify_rate": modify_rate,
        "kappa": kappa,
        "status_counts": counts,
        "progress_percent": round(reviewed / total * 100, 1) if total else 0.0,
    }


def _approx_kappa(reviewed_qs):
    import json as _json

    rows = []
    for u in reviewed_qs:
        if u.ai_prediction is not None and u.human_label is not None:
            rows.append(
                (
                    _json.dumps(u.ai_prediction, ensure_ascii=False, sort_keys=True),
                    _json.dumps(u.human_label, ensure_ascii=False, sort_keys=True),
                )
            )
    if not rows:
        return None
    po = sum(1 for a, h in rows if a == h) / len(rows)
    # pe：基于 AI 与人工类别分布的随机一致性近似
    def _dist(items):
        d = {}
        for x in items:
            d[x] = d.get(x, 0) + 1
        return {k: v / len(items) for k, v in d.items()}

    da = _dist([a for a, _ in rows])
    dh = _dist([h for _, h in rows])
    pe = sum(da.get(k, 0) * dh.get(k, 0) for k in set(list(da) + list(dh)))
    if pe == 1:
        return 1.0
    k = (po - pe) / (1 - pe) if (1 - pe) else 1.0
    return round(k, 3)


@api_view(["GET"])
@permission_classes([allow_roles(*QUALITY_ROLES)])
def quality_report(request, tid):
    try:
        task = Task.objects.get(id=tid)
    except Task.DoesNotExist:
        return Response({"error": "任务不存在"}, status=404)
    return Response(compute_quality(task))


@api_view(["POST"])
@permission_classes([allow_roles(*QUALITY_ROLES)])
def gold_check(request, tid):
    """金标抽检：从已审核样本中抽取 N 条作为基准，评估 AI / 人工质量。"""
    n = min(int(request.data.get("count", 10)), 50)
    try:
        task = Task.objects.get(id=tid)
    except Task.DoesNotExist:
        return Response({"error": "任务不存在"}, status=404)

    gold = Unit.objects.filter(task=task, human_reviewed=True).order_by("?")[:n]
    if not gold:
        return Response({"success": False, "message": "暂无已审核样本用于抽检"}, status=400)

    agree = 0
    for u in gold:
        import json as _json

        if u.ai_prediction is not None and _json.dumps(u.ai_prediction, ensure_ascii=False, sort_keys=True) == _json.dumps(u.human_label, ensure_ascii=False, sort_keys=True):
            agree += 1
    accuracy = round(agree / gold.count() * 100, 1)

    log_action(request.user, "gold:check", "task", tid, {"sampled": gold.count(), "ai_accuracy": accuracy})
    return Response({"success": True, "sampled": gold.count(), "ai_accuracy": accuracy, "agree": agree})