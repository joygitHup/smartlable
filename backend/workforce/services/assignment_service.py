"""任务分配服务：技能匹配 + 负载均衡(F9.2/F9.3)。"""
from django.db import transaction

from core.models import Role, User, log_action

from ..constants import WorkforceErrorCode
from ..models import Assignment, AssignmentStatus
from ..utils import business_error


def _required_skills(task, override=None) -> list:
    if override:
        return list(override)
    spec = task.spec or {}
    return list(spec.get("skills") or spec.get("required_skills") or [])


def _active_load(user) -> int:
    return Assignment.objects.filter(
        assignee=user, status__in=[AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS]
    ).count()


@transaction.atomic
def allocate(task, actor, count: int = 1, required_skills=None) -> list:
    """按技能交集 + 负载未满选人，创建 Assignment 记录。

    返回 [{assignment_id, assignee, matched_skills, load, score}]。
    """
    required = set(_required_skills(task, required_skills))
    candidates = User.objects.filter(is_active=True, role=Role.ANNOTATOR)

    ranked = []
    for user in candidates:
        skills = set(user.skills or [])
        matched = sorted(skills & required)
        if required and not matched:
            continue
        load = _active_load(user)
        if user.max_load and load >= user.max_load:
            continue
        ranked.append((user, matched, load))

    # 命中技能多者优先，其次负载低者优先
    ranked.sort(key=lambda item: (-len(item[1]), item[2]))
    picked = ranked[: max(1, count)]
    if not picked:
        raise business_error(WorkforceErrorCode.NO_CANDIDATE, status_code=409)

    results = []
    for user, matched, load in picked:
        assignment = Assignment.objects.create(
            task=task,
            assignee=user,
            assigned_by=actor,
            status=AssignmentStatus.ASSIGNED,
            matched_skills=matched,
            score=float(len(matched)),
        )
        results.append(
            {
                "assignment_id": assignment.id,
                "assignee": user.username,
                "matched_skills": matched,
                "load": load,
                "score": float(len(matched)),
            }
        )
    log_action(actor, "workforce:assign", "task", task.id, {"assigned": [r["assignee"] for r in results]})
    return results
