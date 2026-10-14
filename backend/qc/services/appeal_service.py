"""申诉通道服务(F11.7)。"""
from django.db import transaction

from core.models import log_action
from tasks.models import UnitStatus

from ..constants import QC_ERROR_MESSAGE, QcErrorCode
from ..models import Appeal, AppealStatus
from ..utils import business_error


def _err(code, status_code=400, message=None):
    return business_error(code, message or QC_ERROR_MESSAGE.get(code), status_code=status_code)


@transaction.atomic
def handle_appeal(appeal: Appeal, user, status: str, resolution: str = "") -> Appeal:
    """处理申诉：受理则重开关联 unit 复核，驳回则仅记录结论。"""
    if status not in (AppealStatus.ACCEPTED, AppealStatus.REJECTED):
        raise _err(QcErrorCode.INVALID_STATUS, status_code=400, message="status 只能是 accepted/rejected")
    if appeal.status != AppealStatus.OPEN:
        raise _err(QcErrorCode.INVALID_STATUS, status_code=409)

    appeal.status = status
    appeal.handled_by = user
    appeal.resolution = resolution or ""
    appeal.save(update_fields=["status", "handled_by", "resolution", "updated_at"])

    if status == AppealStatus.ACCEPTED and appeal.unit_id:
        unit = appeal.unit
        unit.status = UnitStatus.PENDING_REVIEW
        unit.human_label = None
        unit.human_reviewed = False
        unit.reviewed_by = None
        unit.review_reason = "申诉受理，重新复核"
        unit.save(update_fields=["status", "human_label", "human_reviewed", "reviewed_by", "review_reason"])

    log_action(user, "qc:appeal_handle", "appeal", appeal.id, {"status": status})
    return appeal
