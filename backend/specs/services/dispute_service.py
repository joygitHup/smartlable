"""争议样本领域服务：认领与裁决。"""
from django.db import transaction

from common.constants import ErrorCode
from core.models import log_action

from ..constants import SpecErrorCode, SPEC_ERROR_MESSAGE
from ..models import Arbitration, DisputeSample, DisputeStatus
from ..utils import business_error


def _err(code, status_code=400, message=None):
    return business_error(code, message or SPEC_ERROR_MESSAGE.get(code), status_code=status_code)


@transaction.atomic
def claim_dispute(dispute: DisputeSample, user) -> DisputeSample:
    if dispute.status != DisputeStatus.OPEN:
        raise _err(SpecErrorCode.DISPUTE_INVALID_STATUS, status_code=409)
    dispute.status = DisputeStatus.CLAIMED
    dispute.claimed_by = user
    dispute.save(update_fields=["status", "claimed_by", "updated_at"])
    log_action(user, "dispute:claim", "dispute", dispute.id, {})
    return dispute


@transaction.atomic
def arbitrate_dispute(dispute: DisputeSample, user, decision: str, label, note: str) -> Arbitration:
    if dispute.status == DisputeStatus.RESOLVED:
        raise _err(SpecErrorCode.DISPUTE_INVALID_STATUS, status_code=409)
    if not decision:
        raise business_error(ErrorCode.INVALID_PARAM, "缺少裁决结论", status_code=400)

    arbitration = Arbitration.objects.create(
        dispute=dispute, arbiter=user, decision=decision, label=label, note=note or ""
    )
    dispute.status = DisputeStatus.RESOLVED
    if not dispute.claimed_by:
        dispute.claimed_by = user
    dispute.save(update_fields=["status", "claimed_by", "updated_at"])

    # 可选：把裁决标签回写关联 Unit 的人工标注
    if dispute.unit_id and label is not None:
        unit = dispute.unit
        unit.human_label = label
        unit.human_reviewed = True
        unit.modified_by_human = True
        unit.review_reason = "争议裁决"
        unit.save(update_fields=["human_label", "human_reviewed", "modified_by_human", "review_reason"])

    log_action(user, "dispute:arbitrate", "dispute", dispute.id, {"decision": decision})
    return arbitration
