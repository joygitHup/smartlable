from django.db import models


class ModelStatus(models.TextChoices):
    DRAFT = "draft", "草稿"
    ACTIVE = "active", "在线"
    RETIRED = "retired", "已下线"


class ModelRecord(models.Model):
    """预标注模型版本记录，支撑模型迭代与效果对比(F6)。"""

    name = models.CharField(max_length=128)
    model_id = models.CharField(max_length=64, verbose_name="模型标识")
    task_type = models.CharField(max_length=32, default="classification")
    description = models.TextField(blank=True)
    metrics = models.JSONField(default=dict, blank=True, verbose_name="指标(acc/f1/net)")
    status = models.CharField(max_length=16, choices=ModelStatus.choices, default=ModelStatus.DRAFT)
    created_by = models.ForeignKey('core.User', null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "模型记录"
        verbose_name_plural = "模型记录"

    def __str__(self):
        return f"{self.name} ({self.model_id})"