"""A/B 实验服务(F10.7)：按 split_ratio 分组并基于已有数据评估两臂效果。"""
from django.db import transaction

from common.constants import ErrorCode
from core.models import log_action
from tasks.models import Unit

from ..constants import PRELABEL_ERROR_MESSAGE, PrelabelErrorCode
from ..models import ABExperiment, ExperimentStatus
from ..utils import business_error, same_label


def _err(code, status_code=400, message=None):
    return business_error(code, message or PRELABEL_ERROR_MESSAGE.get(code), status_code=status_code)


def _arm_metrics(units) -> dict:
    """基于已有 Unit 的人工结果评估该臂：AI 与人工一致率作为效果代理指标。"""
    reviewed = [u for u in units if u.human_reviewed and u.human_label is not None and u.ai_prediction]
    agree = sum(1 for u in reviewed if same_label(u.human_label, u.ai_prediction))
    accuracy = round(agree / len(reviewed), 4) if reviewed else None
    return {
        "unit_ids": [u.id for u in units],
        "sample_size": len(units),
        "reviewed": len(reviewed),
        "agree": agree,
        "agreement_accuracy": accuracy,
    }


@transaction.atomic
def run_experiment(experiment: ABExperiment, user=None) -> ABExperiment:
    if experiment.status == ExperimentStatus.FINISHED:
        raise _err(PrelabelErrorCode.EXPERIMENT_INVALID_STATUS, status_code=409)
    units = list(Unit.objects.filter(task=experiment.task).order_by("id"))
    cut = int(len(units) * experiment.split_ratio)
    experiment.result_a = _arm_metrics(units[:cut])
    experiment.result_b = _arm_metrics(units[cut:])
    experiment.status = ExperimentStatus.RUNNING
    experiment.save(update_fields=["result_a", "result_b", "status", "updated_at"])
    log_action(user, "prelabel:experiment_run", "ab_experiment", experiment.id,
               {"sample_size": len(units), "split_ratio": experiment.split_ratio})
    return experiment


@transaction.atomic
def finish_experiment(experiment: ABExperiment, user=None, winner: str = None) -> ABExperiment:
    if experiment.status != ExperimentStatus.RUNNING:
        raise _err(PrelabelErrorCode.EXPERIMENT_INVALID_STATUS, status_code=409)
    if not winner:
        acc_a = (experiment.result_a or {}).get("agreement_accuracy")
        acc_b = (experiment.result_b or {}).get("agreement_accuracy")
        if acc_a is None or acc_b is None:
            winner = "tie"
        elif acc_a > acc_b:
            winner = "a"
        elif acc_b > acc_a:
            winner = "b"
        else:
            winner = "tie"
    if winner not in ("a", "b", "tie"):
        raise business_error(ErrorCode.INVALID_PARAM, "winner 只能是 a/b/tie", status_code=400)
    experiment.winner = winner
    experiment.status = ExperimentStatus.FINISHED
    experiment.save(update_fields=["winner", "status", "updated_at"])
    log_action(user, "prelabel:experiment_finish", "ab_experiment", experiment.id, {"winner": winner})
    return experiment
