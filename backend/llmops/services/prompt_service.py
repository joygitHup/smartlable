"""Prompt 管理服务(F15.1)：创建版本 / 发布版本。"""
from django.db import transaction

from core.models import log_action

from ..constants import LLMOPS_ERROR_MESSAGE, LlmopsErrorCode
from ..models import PromptStatus, PromptTemplate, PromptVersion
from ..utils import business_error


def _err(code, message=None, status_code=400):
    return business_error(code, message or LLMOPS_ERROR_MESSAGE.get(code), status_code=status_code)


@transaction.atomic
def create_version(template: PromptTemplate, content: str, change_note: str = "", user=None) -> PromptVersion:
    """为模板新建一个草稿版本，版本号自增。"""
    if not content or not content.strip():
        raise _err(LlmopsErrorCode.VERSION_REQUIRED, message="Prompt 内容不能为空", status_code=400)
    last = template.versions.order_by("-version").first()
    next_no = (last.version + 1) if last else 1
    version = PromptVersion.objects.create(
        template=template,
        version=next_no,
        content=content,
        change_note=change_note or "",
        status=PromptStatus.DRAFT,
        created_by=user,
    )
    log_action(user, "llmops:prompt_version_create", "prompt_template", template.id, {"version": next_no})
    return version


@transaction.atomic
def publish_version(template: PromptTemplate, version_no: int = 0, user=None) -> PromptTemplate:
    """发布指定版本（默认最新草稿）：归档其它版本并更新模板当前版本。"""
    qs = template.versions.all()
    if version_no:
        version = qs.filter(version=version_no).first()
        if not version:
            raise _err(LlmopsErrorCode.VERSION_NOT_FOUND, status_code=404)
    else:
        version = qs.order_by("-version").first()
        if not version:
            raise _err(LlmopsErrorCode.VERSION_REQUIRED, status_code=400)

    qs.exclude(id=version.id).update(status=PromptStatus.ARCHIVED)
    version.status = PromptStatus.ACTIVE
    version.save(update_fields=["status", "updated_at"])

    template.current_version = version.version
    template.status = PromptStatus.ACTIVE
    template.save(update_fields=["current_version", "status", "updated_at"])

    log_action(user, "llmops:prompt_publish", "prompt_template", template.id, {"version": version.version})
    return template
