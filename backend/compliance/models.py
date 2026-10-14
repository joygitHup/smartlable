"""compliance：数据安全与合规(F12)领域模型。"""
from django.conf import settings
from django.db import models
from django.db.models import Q

from common.models import BaseModel


class DataLevel(models.TextChoices):
    PUBLIC = "public", "公开"
    INTERNAL = "internal", "内部"
    CONFIDENTIAL = "confidential", "机密"
    SECRET = "secret", "绝密"


class DataClassification(BaseModel):
    """数据分级分类(F12.1)。"""

    name = models.CharField(max_length=128, db_index=True, verbose_name="分类名称")
    level = models.CharField(
        max_length=16, choices=DataLevel.choices, default=DataLevel.INTERNAL, db_index=True, verbose_name="数据级别"
    )
    description = models.TextField(blank=True, verbose_name="说明")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_data_classifications"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "数据分级分类"
        verbose_name_plural = "数据分级分类"
        indexes = [models.Index(fields=["level", "name"])]
        constraints = [
            models.UniqueConstraint(
                fields=["name"], condition=Q(is_deleted=False), name="uniq_data_classification_alive"
            )
        ]

    def __str__(self):
        return f"{self.name}[{self.level}]"


class DataClassPolicy(BaseModel):
    """按任务类型的分级访问策略(F12.1)。"""

    task_type = models.CharField(max_length=32, db_index=True, verbose_name="任务类型")
    level = models.CharField(
        max_length=16, choices=DataLevel.choices, default=DataLevel.INTERNAL, db_index=True, verbose_name="数据级别"
    )
    allowed_roles = models.JSONField(default=list, blank=True, verbose_name="允许访问的角色")
    require_secure_env = models.BooleanField(default=False, verbose_name="是否要求安全环境")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_data_class_policies"
    )

    class Meta:
        ordering = ["task_type", "level"]
        verbose_name = "分级访问策略"
        verbose_name_plural = "分级访问策略"
        indexes = [models.Index(fields=["task_type", "level"])]
        constraints = [
            models.UniqueConstraint(
                fields=["task_type", "level"], condition=Q(is_deleted=False), name="uniq_data_class_policy_alive"
            )
        ]

    def __str__(self):
        return f"{self.task_type}:{self.level}"


class Watermark(BaseModel):
    """水印与溯源标识(F12.2)。"""

    target_type = models.CharField(max_length=64, db_index=True, verbose_name="目标类型")
    target_id = models.CharField(max_length=64, db_index=True, verbose_name="目标ID")
    text = models.CharField(max_length=255, blank=True, verbose_name="水印文本")
    token = models.CharField(max_length=64, db_index=True, verbose_name="溯源标识")
    hash = models.CharField(max_length=128, verbose_name="内容指纹")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_watermarks"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "水印溯源"
        verbose_name_plural = "水印溯源"
        indexes = [models.Index(fields=["target_type", "target_id"])]

    def __str__(self):
        return f"WM#{self.id} {self.target_type}:{self.target_id}"


class SecureEnvironment(BaseModel):
    """标注环境隔离配置(F12.3)。"""

    name = models.CharField(max_length=128, db_index=True, verbose_name="环境名称")
    level = models.CharField(
        max_length=16, choices=DataLevel.choices, default=DataLevel.INTERNAL, db_index=True, verbose_name="数据级别"
    )
    allow_screenshot = models.BooleanField(default=False, verbose_name="允许截屏")
    allow_copy = models.BooleanField(default=False, verbose_name="允许复制")
    require_approval = models.BooleanField(default=True, verbose_name="是否需审批")
    enabled = models.BooleanField(default=True, db_index=True, verbose_name="是否启用")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_secure_environments"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "安全环境"
        verbose_name_plural = "安全环境"
        indexes = [models.Index(fields=["level", "enabled"])]
        constraints = [
            models.UniqueConstraint(
                fields=["name"], condition=Q(is_deleted=False), name="uniq_secure_environment_alive"
            )
        ]

    def __str__(self):
        return f"{self.name}[{self.level}]"


class LifecycleAction(models.TextChoices):
    DELETE = "delete", "删除"
    ARCHIVE = "archive", "归档"


class DataLifecyclePolicy(BaseModel):
    """数据生命周期策略(F12.5)。"""

    level = models.CharField(
        max_length=16, choices=DataLevel.choices, default=DataLevel.INTERNAL, db_index=True, verbose_name="数据级别"
    )
    retention_days = models.PositiveIntegerField(default=365, verbose_name="保留天数")
    action = models.CharField(
        max_length=16, choices=LifecycleAction.choices, default=LifecycleAction.ARCHIVE, verbose_name="到期动作"
    )
    applies_to_task_type = models.CharField(max_length=32, blank=True, db_index=True, verbose_name="适用任务类型")
    enabled = models.BooleanField(default=True, db_index=True, verbose_name="是否启用")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_lifecycle_policies"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "数据生命周期策略"
        verbose_name_plural = "数据生命周期策略"
        indexes = [models.Index(fields=["enabled", "level"])]
        constraints = [
            models.UniqueConstraint(
                fields=["level", "applies_to_task_type"],
                condition=Q(is_deleted=False),
                name="uniq_lifecycle_policy_alive",
            )
        ]

    def __str__(self):
        return f"{self.level}/{self.applies_to_task_type or 'all'}@{self.retention_days}d[{self.action}]"


class ComplianceFramework(models.TextChoices):
    GDPR = "GDPR", "GDPR"
    PIPL = "PIPL", "个人信息保护法"
    OTHER = "other", "其他"


class ComplianceChecklist(BaseModel):
    """合规检查清单项(F12.6)。"""

    framework = models.CharField(
        max_length=16, choices=ComplianceFramework.choices, default=ComplianceFramework.OTHER, db_index=True
    )
    item = models.CharField(max_length=255, verbose_name="检查项")
    description = models.TextField(blank=True, verbose_name="说明")
    required = models.BooleanField(default=True, verbose_name="是否必需")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_compliance_checklists"
    )

    class Meta:
        ordering = ["framework", "id"]
        verbose_name = "合规检查项"
        verbose_name_plural = "合规检查项"
        indexes = [models.Index(fields=["framework", "required"])]
        constraints = [
            models.UniqueConstraint(
                fields=["framework", "item"], condition=Q(is_deleted=False), name="uniq_compliance_checklist_alive"
            )
        ]

    def __str__(self):
        return f"{self.framework}:{self.item}"


class CheckStatus(models.TextChoices):
    PASS = "pass", "通过"
    FAIL = "fail", "不通过"
    PENDING = "pending", "待评估"


class ComplianceCheckResult(BaseModel):
    """合规检查结果(F12.6)。"""

    checklist = models.ForeignKey(ComplianceChecklist, on_delete=models.CASCADE, related_name="results")
    status = models.CharField(
        max_length=16, choices=CheckStatus.choices, default=CheckStatus.PENDING, db_index=True
    )
    checked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="compliance_check_results",
    )
    note = models.TextField(blank=True, verbose_name="评估备注")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "合规检查结果"
        verbose_name_plural = "合规检查结果"
        indexes = [models.Index(fields=["checklist", "status"])]

    def __str__(self):
        return f"Check#{self.id} checklist#{self.checklist_id} [{self.status}]"
