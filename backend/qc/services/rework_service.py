"""返工机制服务(F11.6)。"""
from django.db import transaction

from core.models import log_action
from tasks.models import UnitStatus

from ..constants import QC_ERROR_MESSAGE, QcErrorCode
from ..models import ReworkStatus, ReworkTask
from ..utils import business_error


def _err(code, status_code=400, message=None):
    return business_error(code, message or QC_ERROR_MESSAGE.get(code), status_code=status_code)


@transaction.atomic
def complete_rework(rework: ReworkTask, user=None) -> ReworkTask:
    """完成返工：更新状态，并把关联 unit 退回待审核以重新标注。"""
    if rework.status == ReworkStatus.CLOSED:
        raise _err(QcErrorCode.INVALID_STATUS, status_code=409)
    rework.status = ReworkStatus.REWORKED
    rework.save(update_fields=["status", "updated_at"])
    if rework.unit_id:
        unit = rework.unit
        unit.status = UnitStatus.PENDING_REVIEW
        unit.human_label = None
        unit.human_reviewed = False
        unit.modified_by_human = False
        unit.save(update_fields=["status", "human_label", "human_reviewed", "modified_by_human"])
    log_action(user, "qc:rework_complete", "rework_task", rework.id, {"unit_id": rework.unit_id})
    return rework
