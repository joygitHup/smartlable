"""规范文档领域服务：版本管理、发布、初稿生成、变更影响分析。"""
from django.db import transaction

from common.constants import ErrorCode
from core.models import log_action
from tasks.models import Unit

from ..constants import SpecErrorCode, SPEC_ERROR_MESSAGE
from ..models import SpecDocument, SpecStatus, SpecVersion, SpecVersionStatus
from ..utils import business_error, line_diff


def _err(code, status_code=400, message=None):
    return business_error(code, message or SPEC_ERROR_MESSAGE.get(code), status_code=status_code)


@transaction.atomic
def create_version(spec: SpecDocument, version: int, content: str, change_note: str, user) -> SpecVersion:
    if SpecVersion.objects.filter(spec=spec, version=version).exists():
        raise _err(SpecErrorCode.VERSION_EXISTS, status_code=409)
    ver = SpecVersion.objects.create(
        spec=spec,
        version=version,
        content=content or "",
        change_note=change_note or "",
        status=SpecVersionStatus.DRAFT,
        created_by=user,
    )
    log_action(user, "spec:version_create", "spec", spec.id, {"version": version})
    return ver


@transaction.atomic
def publish_version(spec: SpecDocument, version: int, user) -> SpecVersion:
    try:
        ver = SpecVersion.objects.get(spec=spec, version=version)
    except SpecVersion.DoesNotExist:
        raise _err(SpecErrorCode.VERSION_NOT_FOUND, status_code=404)

    # 归档其它已发布版本，保证同一规范只有一个生效版本
    SpecVersion.objects.filter(spec=spec, status=SpecVersionStatus.PUBLISHED).exclude(id=ver.id).update(
        status=SpecVersionStatus.ARCHIVED
    )
    ver.status = SpecVersionStatus.PUBLISHED
    ver.save(update_fields=["status", "updated_at"])

    spec.status = SpecStatus.PUBLISHED
    spec.current_version = version
    spec.content = ver.content
    spec.save(update_fields=["status", "current_version", "content", "updated_at"])
    log_action(user, "spec:publish", "spec", spec.id, {"version": version})
    return ver


class _SpecTaskProxy:
    """给 ai.service.run_inference 提供 task 契约（task_type / spec）的轻量代理。"""

    def __init__(self, spec: SpecDocument, task):
        self.task_type = task.task_type if task else spec.task_type
        self.spec = (task.spec if task and task.spec else {"instructions": spec.content, "labels": []}) or {}


@transaction.atomic
def generate_draft(spec: SpecDocument, user) -> dict:
    """基于关联任务/规范正文，best-effort 调用 LLM 生成规范初稿（F8.5）。失败抛 BusinessError，不伪造。"""
    task = spec.task
    source_text = spec.content or (task.description if task else "") or spec.title
    if not source_text:
        raise _err(SpecErrorCode.MISSING_SOURCE, status_code=400)

    from ai import service  # 延迟导入，复用现有 LLM 调用

    try:
        result = service.run_inference(_SpecTaskProxy(spec, task), source_text)
    except Exception as exc:  # noqa: BLE001 - 外部服务失败统一转业务异常
        raise _err(ErrorCode.EXTERNAL_ERROR, status_code=503, message=f"规范初稿生成失败：{exc}")

    draft_text = _render_draft(spec, result)
    log_action(user, "spec:generate_draft", "spec", spec.id, {"task_type": spec.task_type})
    return {
        "spec_id": spec.id,
        "task_type": spec.task_type,
        "draft": draft_text,
        "raw": result,
    }


def _render_draft(spec: SpecDocument, result: dict) -> str:
    """把 LLM 输出整理为可读的规范初稿文本。"""
    prediction = result.get("prediction", {})
    confidence = result.get("confidence")
    if isinstance(prediction, dict) and "label" in prediction:
        body = f"建议主类别：{prediction.get('label')}"
    else:
        body = str(prediction)
    return (
        f"# {spec.title} 规范初稿（AI 生成，待人工确认）\n"
        f"- 任务类型：{spec.task_type}\n"
        f"- 模型建议：{body}\n"
        f"- 置信度：{confidence}\n"
        f"- 说明：本初稿为 best-effort 生成结果，请人工复核后再发布。\n"
    )


def _affected_unit_qs(spec: SpecDocument):
    """规范影响范围内的数据单元：优先精确定位到关联任务，否则按任务类型。"""
    if spec.task_id:
        return Unit.objects.filter(task=spec.task)
    return Unit.objects.filter(task__task_type=spec.task_type)


def impact_analysis(spec: SpecDocument, from_version=None, to_version=None) -> dict:
    """规范变更影响分析（F8.7）：给出版本差异 + 需重标 unit 数。"""
    versions = {v.version: v for v in spec.versions.all()}
    if not versions:
        raise _err(SpecErrorCode.VERSION_NOT_FOUND, status_code=404)

    base_no = from_version if from_version in versions else spec.current_version
    if base_no not in versions:
        base_no = min(versions)
    target_no = to_version if to_version in versions else max(versions)

    diff = line_diff(versions[base_no].content, versions[target_no].content)

    units = _affected_unit_qs(spec)
    total = units.count()
    affected = units.filter(human_reviewed=True).count()

    return {
        "spec_id": spec.id,
        "from_version": base_no,
        "to_version": target_no,
        "changed": base_no != target_no,
        "diff": diff,
        "total_units": total,
        "affected_units": affected,
        "requires_relabel": affected > 0,
    }


@transaction.atomic
def create_relabel_rework(spec: SpecDocument, from_version=None, to_version=None, user=None, reason="") -> dict:
    """按规范变更影响分析，为受影响单元批量创建返工任务(F8.7)。

    仅为已人工审核(受规范变更影响)的单元建返工，已有待返工任务则跳过，避免重复。
    """
    analysis = impact_analysis(spec, from_version, to_version)
    affected_units = _affected_unit_qs(spec).filter(human_reviewed=True)

    from qc.models import ReworkStatus, ReworkTask  # 延迟导入，避免应用间循环依赖

    base_reason = reason or (
        f"规范「{spec.title}」由 v{analysis['from_version']} 变更至 v{analysis['to_version']}，需按新规范重标"
    )
    created = 0
    skipped = 0
    for unit in affected_units:
        if ReworkTask.objects.filter(unit=unit, status=ReworkStatus.PENDING).exists():
            skipped += 1
            continue
        ReworkTask.objects.create(
            task=unit.task,
            unit=unit,
            reason=base_reason,
            status=ReworkStatus.PENDING,
            source="spec_impact",
        )
        created += 1

    log_action(
        user,
        "spec:relabel_impact",
        "spec",
        spec.id,
        {"created": created, "skipped": skipped, "from": analysis["from_version"], "to": analysis["to_version"]},
    )
    return {
        **analysis,
        "reason": base_reason,
        "rework_created": created,
        "rework_skipped": skipped,
    }
