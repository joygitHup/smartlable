"""specs：标注规范与冷启动(F8)领域模型。"""
from django.conf import settings
from django.db import models
from django.db.models import Q

from common.models import BaseModel


class SpecStatus(models.TextChoices):
    DRAFT = "draft", "草稿"
    PUBLISHED = "published", "已发布"
    ARCHIVED = "archived", "已归档"


class SpecVersionStatus(models.TextChoices):
    DRAFT = "draft", "草稿"
    PUBLISHED = "published", "已发布"
    ARCHIVED = "archived", "已归档"


class SpecDocument(BaseModel):
    """标注规范文档：承载标签体系/规范文本，支持多版本迭代(F8.1/F8.2)。"""

    title = models.CharField(max_length=128, db_index=True)
    task_type = models.CharField(max_length=32, db_index=True)
    # 关联任务（可选）：用于按任务上下文生成初稿与影响分析
    task = models.ForeignKey(
        "tasks.Task", null=True, blank=True, on_delete=models.SET_NULL, related_name="spec_documents"
    )
    content = models.TextField(blank=True, verbose_name="规范正文")
    status = models.CharField(
        max_length=16, choices=SpecStatus.choices, default=SpecStatus.DRAFT, db_index=True
    )
    current_version = models.PositiveIntegerField(default=0, verbose_name="当前生效版本")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_specs"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "标注规范文档"
        verbose_name_plural = "标注规范文档"
        indexes = [models.Index(fields=["task_type", "status"])]

    def __str__(self):
        return self.title

    def clean(self):
        if self.current_version < 0:
            from django.core.exceptions import ValidationError

            raise ValidationError("current_version 不能为负数")


class SpecVersion(BaseModel):
    """规范版本快照：记录每次修订内容，支持发布与回滚。"""

    spec = models.ForeignKey(SpecDocument, on_delete=models.CASCADE, related_name="versions")
    version = models.PositiveIntegerField(verbose_name="版本号")
    content = models.TextField(verbose_name="版本正文")
    change_note = models.CharField(max_length=255, blank=True, verbose_name="变更说明")
    status = models.CharField(
        max_length=16, choices=SpecVersionStatus.choices, default=SpecVersionStatus.DRAFT
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_spec_versions"
    )

    class Meta:
        ordering = ["-version"]
        verbose_name = "规范版本"
        verbose_name_plural = "规范版本"
        constraints = [
            models.UniqueConstraint(
                fields=["spec", "version"], condition=Q(is_deleted=False), name="uniq_spec_version_alive"
            )
        ]

    def __str__(self):
        return f"{self.spec_id}#v{self.version}"


class DisputeStatus(models.TextChoices):
    OPEN = "open", "待认领"
    CLAIMED = "claimed", "已认领"
    RESOLVED = "resolved", "已裁决"


class DisputeSample(BaseModel):
    """争议样本：标注分歧仲裁入口(F8.4)。"""

    task = models.ForeignKey("tasks.Task", on_delete=models.CASCADE, related_name="disputes")
    unit = models.ForeignKey("tasks.Unit", null=True, blank=True, on_delete=models.SET_NULL, related_name="disputes")
    raised_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="raised_disputes"
    )
    reason = models.TextField(blank=True, verbose_name="争议原因")
    status = models.CharField(
        max_length=16, choices=DisputeStatus.choices, default=DisputeStatus.OPEN, db_index=True
    )
    claimed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="claimed_disputes",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "争议样本"
        verbose_name_plural = "争议样本"
        indexes = [models.Index(fields=["task", "status"])]

    def __str__(self):
        return f"Dispute#{self.id} [{self.status}]"


class Arbitration(BaseModel):
    """争议裁决记录：保存专家裁决结论与可选标签回写。"""

    dispute = models.OneToOneField(DisputeSample, on_delete=models.CASCADE, related_name="arbitration")
    arbiter = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="arbitrations"
    )
    decision = models.CharField(max_length=64, verbose_name="裁决结论")
    label = models.JSONField(default=None, null=True, blank=True, verbose_name="裁决标签")
    note = models.TextField(blank=True, verbose_name="裁决说明")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "争议裁决"
        verbose_name_plural = "争议裁决"

    def __str__(self):
        return f"Arbitration#{self.id} -> dispute#{self.dispute_id}"


class Difficulty(models.TextChoices):
    EASY = "easy", "简单"
    MEDIUM = "medium", "中等"
    HARD = "hard", "困难"


class TrainingSet(BaseModel):
    """培训题库：用于标注员冷启动培训与考核(F8.6)。"""

    title = models.CharField(max_length=128, db_index=True)
    task_type = models.CharField(max_length=32, db_index=True)
    question = models.TextField(verbose_name="题干")
    options = models.JSONField(default=list, blank=True, verbose_name="选项")
    answer = models.JSONField(default=None, null=True, blank=True, verbose_name="标准答案")
    difficulty = models.CharField(
        max_length=16, choices=Difficulty.choices, default=Difficulty.MEDIUM, db_index=True
    )
    reference = models.TextField(blank=True, verbose_name="规范参考")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_trainings"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "培训题"
        verbose_name_plural = "培训题"
        indexes = [models.Index(fields=["task_type", "difficulty"])]

    def __str__(self):
        return self.title


class TrainingAttempt(BaseModel):
    """培训作答记录：记录得分与是否通过。"""

    quiz = models.ForeignKey(TrainingSet, on_delete=models.CASCADE, related_name="attempts")
    trainee = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="training_attempts"
    )
    answer = models.JSONField(default=None, null=True, blank=True, verbose_name="作答")
    passed = models.BooleanField(default=False, db_index=True)
    score = models.FloatField(default=0.0, verbose_name="得分")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "培训作答"
        verbose_name_plural = "培训作答"
        indexes = [models.Index(fields=["quiz", "passed"])]

    def __str__(self):
        return f"Attempt#{self.id} quiz#{self.quiz_id} passed={self.passed}"
