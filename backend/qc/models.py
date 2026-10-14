"""qc：质量管理"深水区"(F11)领域模型。"""
from django.conf import settings
from django.db import models
from django.db.models import Q

from common.models import BaseModel


class GoldSample(BaseModel):
    """埋点金标样本：作为质量抽检基准(F11.1)。"""

    task = models.ForeignKey("tasks.Task", on_delete=models.CASCADE, related_name="gold_samples")
    content = models.TextField(verbose_name="样本内容")
    expected_label = models.JSONField(default=dict, blank=True, verbose_name="标准标签")
    active = models.BooleanField(default=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_gold_samples"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "金标样本"
        verbose_name_plural = "金标样本"
        indexes = [models.Index(fields=["task", "active"])]

    def __str__(self):
        return f"Gold#{self.id} task#{self.task_id}"


class GoldInjection(BaseModel):
    """金标注入记录：记录样本混入任务队列的情况(F11.1)。"""

    task = models.ForeignKey("tasks.Task", on_delete=models.CASCADE, related_name="gold_injections")
    sample = models.ForeignKey(GoldSample, on_delete=models.CASCADE, related_name="injections")
    unit = models.ForeignKey(
        "tasks.Unit", null=True, blank=True, on_delete=models.SET_NULL, related_name="gold_injections"
    )
    batch = models.CharField(max_length=64, blank=True, db_index=True, verbose_name="批次")
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_gold_injections",
    )
    injected_at = models.DateTimeField(null=True, blank=True, verbose_name="注入时间")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "金标注入记录"
        verbose_name_plural = "金标注入记录"
        indexes = [models.Index(fields=["task", "batch"])]

    def __str__(self):
        return f"Inject#{self.id} sample#{self.sample_id}"


class CheatPatternType(models.TextChoices):
    SAME_LABEL = "same_label", "连续同标签"
    TOO_FAST = "too_fast", "审核过快"
    COPY_PASTE = "copy_paste", "照抄AI"


class CheatStatus(models.TextChoices):
    OPEN = "open", "待处理"
    CONFIRMED = "confirmed", "已确认"
    DISMISSED = "dismissed", "已排除"


class CheatDetection(BaseModel):
    """作弊检测记录(F11.2)。"""

    task = models.ForeignKey("tasks.Task", on_delete=models.CASCADE, related_name="cheat_detections")
    annotator = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="cheat_detections",
    )
    pattern_type = models.CharField(max_length=32, choices=CheatPatternType.choices, db_index=True)
    evidence = models.JSONField(default=dict, blank=True, verbose_name="证据")
    score = models.FloatField(default=0.0, verbose_name="可疑分")
    status = models.CharField(
        max_length=16, choices=CheatStatus.choices, default=CheatStatus.OPEN, db_index=True
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "作弊检测"
        verbose_name_plural = "作弊检测"
        indexes = [models.Index(fields=["task", "pattern_type"]), models.Index(fields=["annotator", "status"])]

    def __str__(self):
        return f"Cheat#{self.id} {self.pattern_type} user#{self.annotator_id}"


class CrossReviewStatus(models.TextChoices):
    PENDING = "pending", "待复核"
    AGREED = "agreed", "一致"
    DISAGREED = "disagreed", "不一致"
    RESOLVED = "resolved", "已裁决"


class CrossReview(BaseModel):
    """交叉复核记录：两位复核人对同一 unit 独立标注(F11.3)。"""

    unit = models.ForeignKey("tasks.Unit", on_delete=models.CASCADE, related_name="cross_reviews")
    reviewer_a = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="cross_reviews_a"
    )
    reviewer_b = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="cross_reviews_b"
    )
    label_a = models.JSONField(default=None, null=True, blank=True, verbose_name="复核人A结果")
    label_b = models.JSONField(default=None, null=True, blank=True, verbose_name="复核人B结果")
    agreed = models.BooleanField(default=False, db_index=True)
    status = models.CharField(
        max_length=16, choices=CrossReviewStatus.choices, default=CrossReviewStatus.PENDING, db_index=True
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "交叉复核"
        verbose_name_plural = "交叉复核"
        indexes = [models.Index(fields=["unit", "status"])]

    def __str__(self):
        return f"Cross#{self.id} unit#{self.unit_id} [{self.status}]"


class AnnotatorProfile(BaseModel):
    """标注员能力画像(F11.4)。"""

    annotator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="qc_profiles"
    )
    task_type = models.CharField(max_length=32, db_index=True)
    accuracy = models.FloatField(default=0.0, verbose_name="准确率")
    category_metrics = models.JSONField(default=dict, blank=True, verbose_name="类别指标")
    total_reviewed = models.PositiveIntegerField(default=0, verbose_name="累计审核量")

    class Meta:
        ordering = ["-accuracy"]
        verbose_name = "标注员能力画像"
        verbose_name_plural = "标注员能力画像"
        indexes = [models.Index(fields=["task_type", "accuracy"])]
        constraints = [
            models.UniqueConstraint(
                fields=["annotator", "task_type"],
                condition=Q(is_deleted=False),
                name="uniq_annotator_profile_alive",
            )
        ]

    def __str__(self):
        return f"Profile user#{self.annotator_id} {self.task_type}"


class QualityTrend(BaseModel):
    """质量趋势落库快照(F11.5)。"""

    annotator = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="quality_trends"
    )
    task = models.ForeignKey(
        "tasks.Task", null=True, blank=True, on_delete=models.SET_NULL, related_name="quality_trends"
    )
    date = models.DateField(db_index=True, verbose_name="日期")
    accuracy = models.FloatField(default=0.0, verbose_name="准确率")
    sample_size = models.PositiveIntegerField(default=0, verbose_name="样本量")

    class Meta:
        ordering = ["-date"]
        verbose_name = "质量趋势"
        verbose_name_plural = "质量趋势"
        indexes = [models.Index(fields=["annotator", "date"]), models.Index(fields=["task", "date"])]

    def __str__(self):
        return f"Trend {self.date} user#{self.annotator_id}"


class ReworkStatus(models.TextChoices):
    PENDING = "pending", "待返工"
    REWORKED = "reworked", "已返工"
    CLOSED = "closed", "已关闭"


class ReworkTask(BaseModel):
    """返工任务(F11.6)。"""

    task = models.ForeignKey("tasks.Task", on_delete=models.CASCADE, related_name="rework_tasks")
    unit = models.ForeignKey(
        "tasks.Unit", null=True, blank=True, on_delete=models.SET_NULL, related_name="rework_tasks"
    )
    reason = models.TextField(blank=True, verbose_name="返工原因")
    status = models.CharField(
        max_length=16, choices=ReworkStatus.choices, default=ReworkStatus.PENDING, db_index=True
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="rework_tasks"
    )
    source = models.CharField(max_length=32, blank=True, verbose_name="来源")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "返工任务"
        verbose_name_plural = "返工任务"
        indexes = [models.Index(fields=["task", "status"])]

    def __str__(self):
        return f"Rework#{self.id} unit#{self.unit_id} [{self.status}]"


class AppealStatus(models.TextChoices):
    OPEN = "open", "待处理"
    ACCEPTED = "accepted", "已受理"
    REJECTED = "rejected", "已驳回"


class Appeal(BaseModel):
    """标注员申诉(F11.7)。"""

    annotator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="qc_appeals"
    )
    unit = models.ForeignKey(
        "tasks.Unit", null=True, blank=True, on_delete=models.SET_NULL, related_name="appeals"
    )
    reason = models.TextField(blank=True, verbose_name="申诉理由")
    status = models.CharField(
        max_length=16, choices=AppealStatus.choices, default=AppealStatus.OPEN, db_index=True
    )
    handled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="handled_appeals"
    )
    resolution = models.TextField(blank=True, verbose_name="处理结论")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "申诉"
        verbose_name_plural = "申诉"
        indexes = [models.Index(fields=["annotator", "status"])]

    def __str__(self):
        return f"Appeal#{self.id} user#{self.annotator_id} [{self.status}]"
