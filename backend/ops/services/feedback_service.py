"""反馈处理服务(F14.6)。"""
from django.db import transaction

from core.models import log_action

from ..constants import OPS_ERROR_MESSAGE, OpsErrorCode
from ..models import Feedback, FeedbackStatus
from ..utils import business_error


def _err(code, status_code=400, message=None):
    return business_error(code, message or OPS_ERROR_MESSAGE.get(code), status_code=status_code)


@transaction.atomic
def handle_feedback(feedback: Feedback, user, status: str, response: str = "") -> Feedback:
    """处理反馈：更新状态、处理人及回复。"""
    if status not in (FeedbackStatus.OPEN, FeedbackStatus.PROCESSING, FeedbackStatus.CLOSED):
        raise _err(OpsErrorCode.INVALID_STATUS, status_code=400,
                   message="status 只能是 open/processing/closed")
    feedback.status = status
    feedback.handled_by = user
    if response is not None:
        feedback.response = response or ""
    feedback.save(update_fields=["status", "handled_by", "response", "updated_at"])
    log_action(user, "ops:feedback_handle", "feedback", feedback.id, {"status": status})
    return feedback
