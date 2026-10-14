"""合规检查结果评估服务(F12.6)。"""
from django.db import transaction

from core.models import log_action

from ..constants import ComplianceErrorCode
from ..models import CheckStatus, ComplianceCheckResult
from ..utils import business_error


@transaction.atomic
def evaluate_result(result: ComplianceCheckResult, status: str, note: str = "", user=None) -> ComplianceCheckResult:
    """记录评估结果：更新状态、评估人与备注。"""
    if status not in CheckStatus.values:
        raise business_error(
            ComplianceErrorCode.INVALID_STATUS,
            "status 只能是 pass/fail/pending",
            status_code=400,
        )
    result.status = status
    result.note = note or ""
    result.checked_by = user
    result.save(update_fields=["status", "note", "checked_by", "updated_at"])
    log_action(user, "compliance:check_evaluate", "compliance_check_result", result.id, {"status": status})
    return result
