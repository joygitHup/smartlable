"""llmops：LLM 时代新标注范式(F15)领域模型。"""
from django.conf import settings
from django.db import models
from django.db.models import Q

from common.models import BaseModel


class PromptStatus(models.TextChoices):
    DRAFT = "draft", "草稿"
    ACTIVE = "active", "启用"
    ARCHIVED = "archived", "已归档"


class PromptTemplate(BaseModel):
    """Prompt 模板(F15.1)。"""

    name = models.CharField(max_length=128, db_index=True)
    task_type = models.CharField(max_length=32, blank=True, db_index=True)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=16, choices=PromptStatus.choices, default=PromptStatus.DRAFT, db_index=True
    )
    current_version = models.PositiveIntegerField(default=0, verbose_name="当前版本号")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Prompt 模板"
        verbose_name_plural = "Prompt 模板"
        constraints = [
            models.UniqueConstraint(fields=["name"], condition=Q(is_deleted=False), name="uniq_prompt_name_alive")
        ]

    def __str__(self):
        return f"{self.name}@v{self.current_version}"


class PromptVersion(BaseModel):
    """Prompt 版本(F15.1)。"""

    template = models.ForeignKey(PromptTemplate, on_delete=models.CASCADE, related_name="versions")
    version = models.PositiveIntegerField(default=1, verbose_name="版本号")
    content = models.TextField(verbose_name="Prompt 内容")
    change_note = models.TextField(blank=True, verbose_name="变更说明")
    status = models.CharField(
        max_length=16, choices=PromptStatus.choices, default=PromptStatus.DRAFT, db_index=True
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_prompt_versions"
    )

    class Meta:
        ordering = ["-version"]
        verbose_name = "Prompt 版本"
        verbose_name_plural = "Prompt 版本"
        indexes = [models.Index(fields=["template", "version"])]
        constraints = [
            models.UniqueConstraint(
                fields=["template", "version"], condition=Q(is_deleted=False), name="uniq_prompt_version_alive"
            )
        ]

    def __str__(self):
        return f"PromptVersion#{self.id} t#{self.template_id} v{self.version}"


class LLMCostRecord(BaseModel):
    """LLM 调用成本记录(F15.2)。"""

    task = models.ForeignKey(
        "tasks.Task", null=True, blank=True, on_delete=models.SET_NULL, related_name="llm_costs"
    )
    unit = models.ForeignKey(
        "tasks.Unit", null=True, blank=True, on_delete=models.SET_NULL, related_name="llm_costs"
    )
    model = models.CharField(max_length=64, db_index=True)
    prompt_tokens = models.PositiveIntegerField(default=0, verbose_name="输入 token")
    completion_tokens = models.PositiveIntegerField(default=0, verbose_name="输出 token")
    total_tokens = models.PositiveIntegerField(default=0, verbose_name="总 token")
    cost = models.DecimalField(max_digits=12, decimal_places=6, default=0, verbose_name="成本")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "LLM 成本记录"
        verbose_name_plural = "LLM 成本记录"
        indexes = [models.Index(fields=["model"]), models.Index(fields=["task"])]

    def __str__(self):
        return f"LLMCost#{self.id} {self.model} {self.total_tokens}tok"


class HallucinationStatus(models.TextChoices):
    CLEAN = "clean", "无异常"
    FLAGGED = "flagged", "疑似幻觉"


class HallucinationCheck(BaseModel):
    """LLM 幻觉检测记录(F15.3)。"""

    unit = models.ForeignKey("tasks.Unit", on_delete=models.CASCADE, related_name="hallucination_checks")
    model = models.CharField(max_length=64, blank=True, db_index=True)
    is_hallucination = models.BooleanField(default=False, db_index=True)
    score = models.FloatField(default=0.0, verbose_name="风险分")
    reasons = models.JSONField(default=list, blank=True, verbose_name="命中原因")
    status = models.CharField(
        max_length=16, choices=HallucinationStatus.choices, default=HallucinationStatus.CLEAN, db_index=True
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "幻觉检测"
        verbose_name_plural = "幻觉检测"
        indexes = [models.Index(fields=["unit", "is_hallucination"])]

    def __str__(self):
        return f"Hallucination#{self.id} unit#{self.unit_id} {'HALL' if self.is_hallucination else 'OK'}"


class ConsistencyReport(BaseModel):
    """人机一致性报告(F15.4)。"""

    task = models.ForeignKey("tasks.Task", on_delete=models.CASCADE, related_name="consistency_reports")
    model = models.CharField(max_length=64, blank=True, db_index=True)
    agreement_rate = models.FloatField(default=0.0, verbose_name="一致率")
    sample_size = models.PositiveIntegerField(default=0, verbose_name="样本量")
    details = models.JSONField(default=dict, blank=True, verbose_name="明细")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "一致性报告"
        verbose_name_plural = "一致性报告"
        indexes = [models.Index(fields=["task"])]

    def __str__(self):
        return f"Consistency#{self.id} task#{self.task_id} rate={self.agreement_rate}"


class DistillStatus(models.TextChoices):
    PENDING = "pending", "待开始"
    RUNNING = "running", "进行中"
    FINISHED = "finished", "已完成"
    FAILED = "failed", "失败"


class DistillationJob(BaseModel):
    """小模型蒸馏作业(F15.5)。"""

    name = models.CharField(max_length=128, db_index=True)
    teacher_model = models.CharField(max_length=64, blank=True, verbose_name="教师模型")
    student_model = models.CharField(max_length=64, blank=True, verbose_name="学生模型")
    task_type = models.CharField(max_length=32, blank=True, db_index=True)
    dataset_size = models.PositiveIntegerField(default=0, verbose_name="数据集规模")
    status = models.CharField(
        max_length=16, choices=DistillStatus.choices, default=DistillStatus.PENDING, db_index=True
    )
    metrics = models.JSONField(default=dict, blank=True, verbose_name="指标")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "蒸馏作业"
        verbose_name_plural = "蒸馏作业"
        indexes = [models.Index(fields=["task_type", "status"])]

    def __str__(self):
        return f"Distill#{self.id} {self.name} [{self.status}]"


class SessionStatus(models.TextChoices):
    OPEN = "open", "进行中"
    CLOSED = "closed", "已关闭"


class MultiRoundSession(BaseModel):
    """多轮标注会话(F15.6)。"""

    task = models.ForeignKey("tasks.Task", on_delete=models.CASCADE, related_name="round_sessions")
    unit = models.ForeignKey(
        "tasks.Unit", null=True, blank=True, on_delete=models.SET_NULL, related_name="round_sessions"
    )
    current_round = models.PositiveIntegerField(default=1, verbose_name="当前轮次")
    max_round = models.PositiveIntegerField(default=3, verbose_name="最大轮次")
    status = models.CharField(
        max_length=16, choices=SessionStatus.choices, default=SessionStatus.OPEN, db_index=True
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "多轮标注会话"
        verbose_name_plural = "多轮标注会话"
        indexes = [models.Index(fields=["task", "status"])]

    def __str__(self):
        return f"Session#{self.id} task#{self.task_id} r{self.current_round}/{self.max_round}"

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.max_round < 1:
            raise ValidationError("max_round 至少为 1")


class RoundRecord(BaseModel):
    """多轮标注轮次记录(F15.6)。"""

    session = models.ForeignKey(MultiRoundSession, on_delete=models.CASCADE, related_name="rounds")
    round_no = models.PositiveIntegerField(default=1, verbose_name="轮次")
    label = models.JSONField(default=dict, blank=True, verbose_name="标注结果")
    annotator = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="round_records"
    )
    notes = models.TextField(blank=True, verbose_name="说明")

    class Meta:
        ordering = ["round_no"]
        verbose_name = "多轮标注记录"
        verbose_name_plural = "多轮标注记录"
        indexes = [models.Index(fields=["session", "round_no"])]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "round_no"], condition=Q(is_deleted=False), name="uniq_round_record_alive"
            )
        ]

    def __str__(self):
        return f"Round#{self.id} session#{self.session_id} r{self.round_no}"
