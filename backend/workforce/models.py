"""workforce：任务调度与人力管理(F9)领域模型。"""
from django.conf import settings
from django.db import models
from django.db.models import Q

from common.models import BaseModel
from tasks.models import Priority


class QueueStatus(models.TextChoices):
    QUEUED = "queued", "排队中"
    ASSIGNED = "assigned", "已分配"
    DONE = "done", "已完成"


class TaskQueueEntry(BaseModel):
    """任务队列条目：支撑优先级排序与调度(F9.1)。"""

    task = models.ForeignKey("tasks.Task", on_delete=models.CASCADE, related_name="queue_entries")
    priority = models.CharField(
        max_length=16, choices=Priority.choices, default=Priority.NORMAL, db_index=True
    )
    order = models.IntegerField(default=0, verbose_name="同优先级内顺序")
    status = models.CharField(
        max_length=16, choices=QueueStatus.choices, default=QueueStatus.QUEUED, db_index=True
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_queue_entries"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "任务队列条目"
        verbose_name_plural = "任务队列条目"
        indexes = [models.Index(fields=["priority", "status"])]

    def __str__(self):
        return f"Queue#{self.id} task#{self.task_id}"


class AssignmentStatus(models.TextChoices):
    ASSIGNED = "assigned", "已分配"
    IN_PROGRESS = "in_progress", "进行中"
    COMPLETED = "completed", "已完成"
    REVOKED = "revoked", "已撤销"


class Assignment(BaseModel):
    """标注分配记录：技能匹配 + 负载均衡结果(F9.2/F9.3)。"""

    task = models.ForeignKey("tasks.Task", on_delete=models.CASCADE, related_name="assignments")
    unit = models.ForeignKey(
        "tasks.Unit", null=True, blank=True, on_delete=models.SET_NULL, related_name="assignments"
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="assignments"
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_work",
    )
    status = models.CharField(
        max_length=16, choices=AssignmentStatus.choices, default=AssignmentStatus.ASSIGNED, db_index=True
    )
    matched_skills = models.JSONField(default=list, blank=True, verbose_name="命中技能")
    score = models.FloatField(default=0.0, verbose_name="匹配得分")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "标注分配"
        verbose_name_plural = "标注分配"
        indexes = [models.Index(fields=["assignee", "status"])]

    def __str__(self):
        return f"Assign#{self.id} -> user#{self.assignee_id}"


class SkillTag(BaseModel):
    """技能标签：供技能匹配使用(F9.2)。"""

    name = models.CharField(max_length=64, db_index=True)
    category = models.CharField(max_length=64, blank=True, db_index=True)
    task_type = models.CharField(max_length=32, blank=True, db_index=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "技能标签"
        verbose_name_plural = "技能标签"
        constraints = [
            models.UniqueConstraint(
                fields=["name"], condition=Q(is_deleted=False), name="uniq_skill_name_alive"
            )
        ]

    def __str__(self):
        return self.name


class Worklog(BaseModel):
    """工时记录：记录有效工时，用于薪资结算与工时预估(F9.5/F9.7)。"""

    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="worklogs"
    )
    task = models.ForeignKey(
        "tasks.Task", null=True, blank=True, on_delete=models.SET_NULL, related_name="worklogs"
    )
    assignment = models.ForeignKey(
        Assignment, null=True, blank=True, on_delete=models.SET_NULL, related_name="worklogs"
    )
    effective_minutes = models.PositiveIntegerField(verbose_name="有效工时(分钟)")
    work_date = models.DateField(null=True, blank=True, verbose_name="工作日期")
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "工时记录"
        verbose_name_plural = "工时记录"
        indexes = [models.Index(fields=["assignee", "work_date"]), models.Index(fields=["task"])]

    def __str__(self):
        return f"Worklog#{self.id} {self.effective_minutes}min"

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.effective_minutes < 0:
            raise ValidationError("effective_minutes 不能为负数")


class PayMode(models.TextChoices):
    PIECE = "piece", "计件"
    HOUR = "hour", "计时"


class PayScheme(BaseModel):
    """计薪方案：支持计件 / 计时(F9.5)。"""

    name = models.CharField(max_length=128, db_index=True)
    mode = models.CharField(max_length=16, choices=PayMode.choices, default=PayMode.PIECE, db_index=True)
    rate = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="单价")
    currency = models.CharField(max_length=8, default="CNY")
    task_type = models.CharField(max_length=32, blank=True, db_index=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "计薪方案"
        verbose_name_plural = "计薪方案"

    def __str__(self):
        return f"{self.name}({self.mode})"


class Shift(BaseModel):
    """班次安排(F9.6)。"""

    name = models.CharField(max_length=128, db_index=True)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="shifts"
    )
    start_at = models.DateTimeField(verbose_name="开始时间")
    end_at = models.DateTimeField(verbose_name="结束时间")
    capacity = models.PositiveIntegerField(default=0, verbose_name="可容纳人数")
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["start_at"]
        verbose_name = "班次"
        verbose_name_plural = "班次"
        indexes = [models.Index(fields=["start_at", "end_at"])]

    def __str__(self):
        return f"{self.name}"

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.start_at and self.end_at and self.end_at <= self.start_at:
            raise ValidationError("班次结束时间必须晚于开始时间")


class WorkEstimate(BaseModel):
    """工时预估记录：基于历史工时均值(F9.7)。"""

    task = models.ForeignKey("tasks.Task", on_delete=models.CASCADE, related_name="estimates")
    estimated_minutes = models.PositiveIntegerField(verbose_name="预估工时(分钟)")
    method = models.CharField(max_length=32, default="history_mean")
    sample_size = models.PositiveIntegerField(default=0, verbose_name="样本量")
    basis = models.JSONField(default=dict, blank=True, verbose_name="预估依据")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_estimates"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "工时预估"
        verbose_name_plural = "工时预估"
        indexes = [models.Index(fields=["task"])]

    def __str__(self):
        return f"Estimate#{self.id} task#{self.task_id} {self.estimated_minutes}min"


class VendorTeam(BaseModel):
    """供应商/外包团队：含隔离标识，保证数据隔离(F9.8)。"""

    name = models.CharField(max_length=128, db_index=True)
    vendor = models.CharField(max_length=128, blank=True, db_index=True)
    isolation_key = models.CharField(max_length=64, db_index=True, verbose_name="隔离标识")
    is_isolated = models.BooleanField(default=True, verbose_name="是否隔离")
    contact = models.CharField(max_length=128, blank=True)
    capacity = models.PositiveIntegerField(default=0, verbose_name="可承载任务量")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "供应商团队"
        verbose_name_plural = "供应商团队"
        indexes = [models.Index(fields=["vendor", "isolation_key"])]

    def __str__(self):
        return f"{self.name}[{self.isolation_key}]"
