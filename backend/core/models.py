from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    ADMIN = "admin", "管理员"
    OPERATOR = "operator", "标注运营"
    ANNOTATOR = "annotator", "标注员"
    ENGINEER = "engineer", "算法工程师"
    PM = "pm", "项目经理"


class User(AbstractUser):
    """扩展用户：角色 + 技能 + 负载，支撑多角色标注运营。"""

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ANNOTATOR)
    skills = models.JSONField(default=list, blank=True, verbose_name="技能标签")
    max_load = models.PositiveIntegerField(default=0, verbose_name="最大并加载荷")
    display_name = models.CharField(max_length=64, blank=True, verbose_name="显示名")

    class Meta:
        verbose_name = "用户"
        verbose_name_plural = "用户"

    @property
    def role_label(self) -> str:
        return Role(self.role).label if self.role in Role.values else self.role


class AuditLog(models.Model):
    """关键操作审计日志，支持全链路追溯。"""

    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=128)
    target_type = models.CharField(max_length=64, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    detail = models.JSONField(default=dict, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "审计日志"
        verbose_name_plural = "审计日志"

    def __str__(self):
        return f"{self.user} {self.action} {self.target_type}:{self.target_id}"


def log_action(user, action, target_type="", target_id="", detail=None):
    AuditLog.objects.create(
        user=user if user and user.is_authenticated else None,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else "",
        detail=detail or {},
    )