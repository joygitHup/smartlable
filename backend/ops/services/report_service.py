"""日报/周报自动生成服务(F14.4)：按周期从 Unit 聚合真实指标并落库。"""
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from core.models import log_action
from tasks.models import Unit, UnitStatus

from ..constants import OPS_ERROR_MESSAGE, OpsErrorCode
from ..models import Report, ReportStatus, ReportType
from ..utils import business_error


def _err(code, message=None, status_code=400):
    return business_error(code, message or OPS_ERROR_MESSAGE.get(code), status_code=status_code)


@transaction.atomic
def generate_report(report_type: str, period_start=None, period_end=None, user=None) -> Report:
    """按周期聚合 Unit 数据生成报表；未传周期时按类型取默认周期（日报=当天，周报=近 7 天）。"""
    today = timezone.localdate()
    if report_type == ReportType.WEEKLY:
        default_start = today - timedelta(days=6)
    else:
        report_type = ReportType.DAILY
        default_start = today

    start = period_start or default_start
    end = period_end or today
    if start > end:
        raise _err(OpsErrorCode.PERIOD_INVALID, message="周期开始不能晚于结束", status_code=400)

    created = Unit.objects.filter(created_at__date__range=(start, end))
    reviewed = Unit.objects.filter(human_reviewed=True, reviewed_at__date__range=(start, end))

    new_units = created.count()
    reviewed_units = reviewed.count()
    auto_approved = created.filter(status=UnitStatus.AUTO_APPROVED).count()
    human_modified = reviewed.filter(modified_by_human=True).count()

    metrics = {
        "new_units": new_units,
        "reviewed_units": reviewed_units,
        "auto_approved": auto_approved,
        "human_modified": human_modified,
        "tasks_touched": created.values("task_id").distinct().count(),
        "auto_pass_rate": round(auto_approved / new_units, 4) if new_units else 0.0,
        "human_modify_rate": round(human_modified / reviewed_units, 4) if reviewed_units else 0.0,
    }

    report = Report.objects.create(
        report_type=report_type,
        period_start=start,
        period_end=end,
        metrics=metrics,
        status=ReportStatus.GENERATED,
        generated_by=user,
    )
    log_action(user, "ops:report_generate", "report", report.id,
               {"report_type": report_type, "period": [start.isoformat(), end.isoformat()]})
    return report
