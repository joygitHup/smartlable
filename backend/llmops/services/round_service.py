"""多轮标注服务(F15.6)：记录一轮结果并推进轮次。"""
from django.db import transaction

from core.models import log_action

from ..constants import LLMOPS_ERROR_MESSAGE, LlmopsErrorCode
from ..models import MultiRoundSession, RoundRecord, SessionStatus
from ..utils import business_error


def _err(code, message=None, status_code=400):
    return business_error(code, message or LLMOPS_ERROR_MESSAGE.get(code), status_code=status_code)


@transaction.atomic
def advance_round(session: MultiRoundSession, label, annotator=None, notes: str = "", user=None):
    """记录当前一轮标注结果并推进轮次；达到 max_round 自动 closed。"""
    if session.status == SessionStatus.CLOSED:
        raise _err(LlmopsErrorCode.SESSION_CLOSED, status_code=409)

    last = RoundRecord.objects.filter(session=session).order_by("-round_no").first()
    round_no = (last.round_no + 1) if last else session.current_round

    record = RoundRecord.objects.create(
        session=session,
        round_no=round_no,
        label=label if label is not None else {},
        annotator=annotator,
        notes=notes or "",
    )

    if round_no >= session.max_round:
        session.status = SessionStatus.CLOSED
        session.save(update_fields=["status", "updated_at"])
    else:
        session.current_round = round_no + 1
        session.save(update_fields=["current_round", "updated_at"])

    log_action(user, "llmops:round_advance", "multi_round_session", session.id,
               {"round_no": round_no, "closed": session.status == SessionStatus.CLOSED})
    return session, record
