"""运营数据看板服务(F14.3)：从 Task/Unit 聚合真实统计，禁止造假。"""
from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from tasks.models import Task, Unit, UnitStatus


def build_dashboard(days: int = 7) -> dict:
    """聚合任务/数据单元的真实运营指标。"""
    now = timezone.now()

    task_total = Task.objects.count()
    by_status = {row["status"]: row["c"] for row in Task.objects.values("status").annotate(c=Count("id"))}
    by_type = {row["task_type"]: row["c"] for row in Task.objects.values("task_type").annotate(c=Count("id"))}

    unit_total = Unit.objects.count()
    # 以 ai_model 非空作为「已 AI 预标注」的口径（预标注落库时会写入模型标识）
    prelabeled = Unit.objects.exclude(ai_model="").count()
    auto_approved = Unit.objects.filter(status=UnitStatus.AUTO_APPROVED).count()
    pending_review = Unit.objects.filter(status=UnitStatus.PENDING_REVIEW).count()
    reviewed = Unit.objects.filter(human_reviewed=True).count()
    modified = Unit.objects.filter(modified_by_human=True).count()

    ai_auto_pass_rate = round(auto_approved / prelabeled, 4) if prelabeled else 0.0
    human_modify_rate = round(modified / reviewed, 4) if reviewed else 0.0

    # 最近趋势：按天统计新增数据单元（单次聚合查询）
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    rows = (
        Unit.objects.filter(created_at__gte=start)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(count=Count("id"))
    )
    by_day = {row["day"].isoformat(): row["count"] for row in rows}
    recent_trend = []
    for i in range(days - 1, -1, -1):
        day = (now - timedelta(days=i)).date().isoformat()
        recent_trend.append({"date": day, "units": by_day.get(day, 0)})

    return {
        "tasks": {"total": task_total, "by_status": by_status, "by_type": by_type},
        "units": {
            "total": unit_total,
            "prelabeled": prelabeled,
            "auto_approved": auto_approved,
            "pending_review": pending_review,
            "reviewed": reviewed,
        },
        "rates": {
            "ai_auto_pass_rate": ai_auto_pass_rate,
            "human_modify_rate": human_modify_rate,
        },
        "recent_trend": recent_trend,
    }
