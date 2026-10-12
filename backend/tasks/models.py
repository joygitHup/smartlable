from django.db import models
from django.conf import settings


class TaskType(models.TextChoices):
    CLASSIFICATION = "classification", "文本分类"
    ENTITY = "entity", "实体抽取"
    SENTIMENT = "sentiment", "情感分析"
    OBJECT_DETECTION = "object_detection", "目标检测"


class Modality(models.TextChoices):
    TEXT = "text", "文本"
    IMAGE = "image", "图片"
    AUDIO = "audio", "音频"


class TaskStatus(models.TextChoices):
    CREATED = "created", "已创建"
    IMPORTING = "importing", "数据导入中"
    PRELABELING = "prelabeling", "AI预标注中"
    REVIEWING = "reviewing", "人工审核中"
    COMPLETED = "completed", "已完成"
    ARCHIVED = "archived", "已归档"


class Priority(models.TextChoices):
    URGENT = "urgent", "紧急"
    HIGH = "high", "高"
    NORMAL = "normal", "普通"
    LOW = "low", "低"


class Task(models.Model):
    """标注任务：配置 AI 预标注、阈值、人工审核比例与优先级。"""

    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    task_type = models.CharField(max_length=32, choices=TaskType.choices, default=TaskType.CLASSIFICATION)
    modality = models.CharField(max_length=16, choices=Modality.choices, default=Modality.TEXT)
    # 标注规范：labels(标签体系)、instructions(规范文本)、schema(结构化要求)
    spec = models.JSONField(default=dict, blank=True)
    # AI 预标注配置
    ai_enabled = models.BooleanField(default=True)
    confidence_threshold = models.FloatField(default=settings.DEFAULT_CONFIDENCE_THRESHOLD)
    manual_review_ratio = models.FloatField(default=settings.DEFAULT_MANUAL_REVIEW_RATIO)
    ai_model = models.CharField(max_length=64, blank=True, default=settings.DEFAULT_LLM_MODEL)
    priority = models.CharField(max_length=16, choices=Priority.choices, default=Priority.NORMAL)
    status = models.CharField(max_length=16, choices=TaskStatus.choices, default=TaskStatus.CREATED)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_tasks")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "标注任务"
        verbose_name_plural = "标注任务"

    def __str__(self):
        return self.name


class UnitStatus(models.TextChoices):
    CREATED = "created", "待处理"
    PRELABELED = "prelabeled", "已预标注"
    AUTO_APPROVED = "auto_approved", "AI自动通过"
    PENDING_REVIEW = "pending_review", "待人工审核"
    REVIEWED = "reviewed", "已审核"


class SplitType(models.TextChoices):
    TRAIN = "train", "训练集"
    VAL = "val", "验证集"
    TEST = "test", "测试集"
    NONE = "none", "未划分"


class Unit(models.Model):
    """单个数据样本：保存 AI 预标注结果与人工审核结果。"""

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="units")
    content = models.TextField(verbose_name="样本内容")
    status = models.CharField(max_length=24, choices=UnitStatus.choices, default=UnitStatus.CREATED)
    split = models.CharField(max_length=8, choices=SplitType.choices, default=SplitType.NONE)
    # AI 预标注结果
    ai_prediction = models.JSONField(default=dict, blank=True, verbose_name="AI预标注")
    confidence = models.FloatField(null=True, blank=True, verbose_name="置信度")
    ai_model = models.CharField(max_length=64, blank=True)
    # 人工结果
    human_label = models.JSONField(default=None, null=True, blank=True, verbose_name="人工标注")
    human_reviewed = models.BooleanField(default=False)
    modified_by_human = models.BooleanField(default=False)
    review_reason = models.CharField(max_length=128, blank=True, verbose_name="修改原因")
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviewed_units")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        verbose_name = "数据单元"
        verbose_name_plural = "数据单元"

    def __str__(self):
        return f"Unit#{self.id} [{self.task_id}]"