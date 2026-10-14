"""prelabel：AI 预标注"现实增强"(F10)领域模型。"""
from django.conf import settings
from django.db import models
from django.db.models import Q

from common.models import BaseModel


class RuleType(models.TextChoices):
    KEYWORD = "keyword", "关键词"
    REGEX = "regex", "正则"


class PrelabelRecordStatus(models.TextChoices):
    SUCCESS = "success", "已预标注"
    FALLBACK = "fallback", "降级待审"
    FAILED = "failed", "预标注失败"


class ClassThreshold(BaseModel):
    """按类别设置的置信度阈值(F10.1)。"""

    task = models.ForeignKey(
        "tasks.Task", null=True, blank=True, on_delete=models.SET_NULL, related_name="class_thresholds"
    )
    task_type = models.CharField(max_length=32, db_index=True)
    label = models.CharField(max_length=64, db_index=True, verbose_name="类别")
    threshold = models.FloatField(default=settings.DEFAULT_CONFIDENCE_THRESHOLD, verbose_name="类别阈值")
    auto_tuned = models.BooleanField(default=False, verbose_name="是否自动调优")
    human_correction_rate = models.FloatField(default=0.0, verbose_name="人工修正率")
    sample_size = models.PositiveIntegerField(default=0, verbose_name="样本量")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_class_thresholds"
    )

    class Meta:
        ordering = ["task_type", "label"]
        verbose_name = "类别阈值"
        verbose_name_plural = "类别阈值"
        indexes = [models.Index(fields=["task_type", "label"])]
        constraints = [
            models.UniqueConstraint(
                fields=["task", "task_type", "label"],
                condition=Q(is_deleted=False),
                name="uniq_class_threshold_alive",
            )
        ]

    def __str__(self):
        return f"{self.task_type}:{self.label}@{self.threshold}"

    def clean(self):
        from django.core.exceptions import ValidationError

        if not 0 <= self.threshold <= 1:
            raise ValidationError("threshold 必须在 0~1 之间")


class PrelabelRecord(BaseModel):
    """可解释的预标注记录：承载多模型候选与解释信息(F10.3/F10.5)。"""

    unit = models.ForeignKey(
        "tasks.Unit", null=True, blank=True, on_delete=models.SET_NULL, related_name="prelabel_records"
    )
    task = models.ForeignKey(
        "tasks.Task", null=True, blank=True, on_delete=models.SET_NULL, related_name="prelabel_records"
    )
    candidates = models.JSONField(default=list, blank=True, verbose_name="多模型候选结果")
    chosen_model = models.CharField(max_length=64, blank=True, verbose_name="采用模型")
    explanation = models.JSONField(default=dict, blank=True, verbose_name="可解释信息")
    status = models.CharField(
        max_length=16, choices=PrelabelRecordStatus.choices, default=PrelabelRecordStatus.SUCCESS, db_index=True
    )
    fallback_reason = models.CharField(max_length=255, blank=True, verbose_name="降级原因")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "预标注记录"
        verbose_name_plural = "预标注记录"
        indexes = [models.Index(fields=["task", "status"])]

    def __str__(self):
        return f"Prelabel#{self.id} unit#{self.unit_id} [{self.status}]"


class PrelabelRule(BaseModel):
    """规则引擎兜底：关键词/正则直接命中标签(F10.6)。"""

    task_type = models.CharField(max_length=32, db_index=True)
    name = models.CharField(max_length=128)
    rule_type = models.CharField(max_length=16, choices=RuleType.choices, default=RuleType.KEYWORD)
    pattern = models.CharField(max_length=255, verbose_name="匹配模式")
    label = models.CharField(max_length=64, verbose_name="命中标签")
    priority = models.IntegerField(default=0, verbose_name="优先级")
    enabled = models.BooleanField(default=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_prelabel_rules"
    )

    class Meta:
        ordering = ["-priority", "id"]
        verbose_name = "预标注规则"
        verbose_name_plural = "预标注规则"
        indexes = [models.Index(fields=["task_type", "enabled"])]
        constraints = [
            models.UniqueConstraint(
                fields=["task_type", "name"], condition=Q(is_deleted=False), name="uniq_prelabel_rule_alive"
            )
        ]

    def __str__(self):
        return f"{self.name}({self.rule_type}:{self.pattern})"


class ExperimentStatus(models.TextChoices):
    DRAFT = "draft", "草稿"
    RUNNING = "running", "进行中"
    FINISHED = "finished", "已结束"


class ABExperiment(BaseModel):
    """多模型 A/B 测试(F10.7)。"""

    task = models.ForeignKey("tasks.Task", on_delete=models.CASCADE, related_name="ab_experiments")
    name = models.CharField(max_length=128)
    model_a = models.CharField(max_length=64, verbose_name="模型A")
    model_b = models.CharField(max_length=64, verbose_name="模型B")
    status = models.CharField(
        max_length=16, choices=ExperimentStatus.choices, default=ExperimentStatus.DRAFT, db_index=True
    )
    split_ratio = models.FloatField(default=0.5, verbose_name="A组比例")
    result_a = models.JSONField(default=dict, blank=True, verbose_name="A组结果")
    result_b = models.JSONField(default=dict, blank=True, verbose_name="B组结果")
    winner = models.CharField(max_length=16, blank=True, verbose_name="胜出方")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_ab_experiments"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "A/B 实验"
        verbose_name_plural = "A/B 实验"
        indexes = [models.Index(fields=["task", "status"])]

    def __str__(self):
        return f"{self.name}[{self.model_a} vs {self.model_b}]"

    def clean(self):
        from django.core.exceptions import ValidationError

        if not 0 <= self.split_ratio <= 1:
            raise ValidationError("split_ratio 必须在 0~1 之间")


class LongTailStrategy(models.TextChoices):
    OVERSAMPLE = "oversample", "过采样"
    EXTRA_REVIEW = "extra_review", "加严复核"
    MANUAL_ONLY = "manual_only", "仅人工"


class LongTailPolicy(BaseModel):
    """长尾类别专项处理策略(F10.8)。"""

    task_type = models.CharField(max_length=32, db_index=True)
    label = models.CharField(max_length=64, db_index=True, verbose_name="长尾类别")
    strategy = models.CharField(
        max_length=16, choices=LongTailStrategy.choices, default=LongTailStrategy.EXTRA_REVIEW, db_index=True
    )
    min_confidence = models.FloatField(default=settings.DEFAULT_CONFIDENCE_THRESHOLD, verbose_name="最低置信度")
    notes = models.TextField(blank=True, verbose_name="备注")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_long_tail_policies"
    )

    class Meta:
        ordering = ["task_type", "label"]
        verbose_name = "长尾类别策略"
        verbose_name_plural = "长尾类别策略"
        indexes = [models.Index(fields=["task_type", "label"])]

    def __str__(self):
        return f"{self.task_type}:{self.label}[{self.strategy}]"
