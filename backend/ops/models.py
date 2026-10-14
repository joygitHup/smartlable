"""ops：运营与协作(F14)领域模型。"""
from django.conf import settings
from django.db import models

from common.models import BaseModel


class Comment(BaseModel):
    """任务/数据单元内评论(F14.1)。"""

    task = models.ForeignKey("tasks.Task", on_delete=models.CASCADE, related_name="ops_comments")
    unit = models.ForeignKey(
        "tasks.Unit", null=True, blank=True, on_delete=models.SET_NULL, related_name="ops_unit_comments"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="ops_comments"
    )
    content = models.TextField(verbose_name="评论内容")
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies"
    )
    mentions = models.JSONField(default=list, blank=True, verbose_name="提及用户")

    class Meta:
        ordering = ["created_at"]
        verbose_name = "评论"
        verbose_name_plural = "评论"
        indexes = [models.Index(fields=["task"]), models.Index(fields=["unit"])]

    def __str__(self):
        return f"Comment#{self.id} task#{self.task_id}"


class AnnouncementLevel(models.TextChoices):
    INFO = "info", "通知"
    WARNING = "warning", "警告"
    URGENT = "urgent", "紧急"


class Announcement(BaseModel):
    """运营公告(F14.2)。"""

    title = models.CharField(max_length=255)
    content = models.TextField(blank=True)
    level = models.CharField(
        max_length=16, choices=AnnouncementLevel.choices, default=AnnouncementLevel.INFO, db_index=True
    )
    target_roles = models.JSONField(default=list, blank=True, verbose_name="目标角色")
    published = models.BooleanField(default=False, db_index=True)
    published_at = models.DateTimeField(null=True, blank=True, verbose_name="发布时间")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_announcements"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "公告"
        verbose_name_plural = "公告"
        indexes = [models.Index(fields=["published", "level"])]

    def __str__(self):
        return f"Announcement#{self.id} {self.title}"


class Notification(BaseModel):
    """站内通知(F14.2)。"""

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ops_notifications"
    )
    title = models.CharField(max_length=255)
    content = models.TextField(blank=True)
    category = models.CharField(max_length=32, blank=True, db_index=True)
    is_read = models.BooleanField(default=False, db_index=True)
    ref_type = models.CharField(max_length=64, blank=True, verbose_name="关联类型")
    ref_id = models.CharField(max_length=64, blank=True, verbose_name="关联ID")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "通知"
        verbose_name_plural = "通知"
        indexes = [models.Index(fields=["recipient", "is_read"])]

    def __str__(self):
        return f"Notification#{self.id} user#{self.recipient_id}"


class ReportType(models.TextChoices):
    DAILY = "daily", "日报"
    WEEKLY = "weekly", "周报"


class ReportStatus(models.TextChoices):
    GENERATED = "generated", "已生成"
    FAILED = "failed", "生成失败"


class Report(BaseModel):
    """运营日报/周报(F14.4)。"""

    report_type = models.CharField(
        max_length=16, choices=ReportType.choices, default=ReportType.DAILY, db_index=True
    )
    period_start = models.DateField(verbose_name="周期开始")
    period_end = models.DateField(verbose_name="周期结束")
    metrics = models.JSONField(default=dict, blank=True, verbose_name="指标")
    status = models.CharField(
        max_length=16, choices=ReportStatus.choices, default=ReportStatus.GENERATED, db_index=True
    )
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="generated_reports"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "运营报表"
        verbose_name_plural = "运营报表"
        indexes = [models.Index(fields=["report_type", "period_start"])]

    def __str__(self):
        return f"Report#{self.id} {self.report_type} {self.period_start}~{self.period_end}"


class FeedbackStatus(models.TextChoices):
    OPEN = "open", "待处理"
    PROCESSING = "processing", "处理中"
    CLOSED = "closed", "已关闭"


class Feedback(BaseModel):
    """用户反馈收集(F14.6)。"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="ops_feedbacks"
    )
    category = models.CharField(max_length=64, blank=True, db_index=True)
    content = models.TextField(verbose_name="反馈内容")
    status = models.CharField(
        max_length=16, choices=FeedbackStatus.choices, default=FeedbackStatus.OPEN, db_index=True
    )
    handled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="handled_feedbacks"
    )
    response = models.TextField(blank=True, verbose_name="处理回复")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "用户反馈"
        verbose_name_plural = "用户反馈"
        indexes = [models.Index(fields=["status", "category"])]

    def __str__(self):
        return f"Feedback#{self.id} [{self.status}]"
