"""培训题与作答领域服务：判分与记录。"""
import json

from django.db import transaction

from core.models import log_action

from ..models import TrainingAttempt, TrainingSet


def _norm(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def grade(quiz: TrainingSet, answer) -> tuple:
    """比较作答与标准答案，返回 (passed, score)。"""
    passed = _norm(answer) == _norm(quiz.answer)
    return passed, 100.0 if passed else 0.0


@transaction.atomic
def submit_attempt(quiz: TrainingSet, user, answer) -> TrainingAttempt:
    passed, score = grade(quiz, answer)
    attempt = TrainingAttempt.objects.create(
        quiz=quiz, trainee=user, answer=answer, passed=passed, score=score
    )
    log_action(user, "training:attempt", "training_set", quiz.id, {"passed": passed, "score": score})
    return attempt
