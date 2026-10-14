"""integration：与业务系统集成(F13)领域模型。"""
from django.conf import settings
from django.db import models
from django.db.models import Q

from common.models import BaseModel


class APIClient(BaseModel):
    """开放 API 客户端(F13.1)。"""

    name = models.CharField(max_length=128, db_index=True, verbose_name="客户端名称")
    key = models.CharField(max_length=64, db_index=True, verbose_name="API Key")
    secret = models.CharField(max_length=128, verbose_name="API Secret")
    scopes = models.JSONField(default=list, blank=True, verbose_name="授权范围")
    enabled = models.BooleanField(default=True, db_index=True, verbose_name="是否启用")
    last_used_at = models.DateTimeField(null=True, blank=True, verbose_name="最近使用时间")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_api_clients"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "开放API客户端"
        verbose_name_plural = "开放API客户端"
        indexes = [models.Index(fields=["enabled"])]
        constraints = [
            models.UniqueConstraint(fields=["key"], condition=Q(is_deleted=False), name="uniq_api_client_key_alive")
        ]

    def __str__(self):
        return f"{self.name}({self.key})"


class Webhook(BaseModel):
    """Webhook 回调配置(F13.2)。"""

    name = models.CharField(max_length=128, db_index=True, verbose_name="名称")
    url = models.URLField(max_length=512, verbose_name="回调地址")
    events = models.JSONField(default=list, blank=True, verbose_name="订阅事件")
    secret = models.CharField(max_length=128, blank=True, verbose_name="签名密钥")
    enabled = models.BooleanField(default=True, db_index=True, verbose_name="是否启用")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_webhooks"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Webhook回调"
        verbose_name_plural = "Webhook回调"
        indexes = [models.Index(fields=["enabled"])]
        constraints = [
            models.UniqueConstraint(fields=["name"], condition=Q(is_deleted=False), name="uniq_webhook_name_alive")
        ]

    def __str__(self):
        return f"{self.name} -> {self.url}"


class DeliveryStatus(models.TextChoices):
    PENDING = "pending", "待投递"
    SUCCESS = "success", "成功"
    FAILED = "failed", "失败"


class WebhookDelivery(BaseModel):
    """Webhook 投递记录(F13.2)。"""

    webhook = models.ForeignKey(Webhook, on_delete=models.CASCADE, related_name="deliveries")
    event = models.CharField(max_length=64, db_index=True, verbose_name="事件")
    payload = models.JSONField(default=dict, blank=True, verbose_name="载荷")
    status = models.CharField(
        max_length=16, choices=DeliveryStatus.choices, default=DeliveryStatus.PENDING, db_index=True
    )
    response_code = models.IntegerField(null=True, blank=True, verbose_name="响应码")
    attempts = models.PositiveIntegerField(default=0, verbose_name="尝试次数")
    error = models.CharField(max_length=255, blank=True, verbose_name="失败原因")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Webhook投递记录"
        verbose_name_plural = "Webhook投递记录"
        indexes = [models.Index(fields=["webhook", "status"])]

    def __str__(self):
        return f"Delivery#{self.id} {self.event} [{self.status}]"


class SourceType(models.TextChoices):
    DATABASE = "database", "数据库"
    OBJECT_STORAGE = "object_storage", "对象存储"
    MESSAGE_QUEUE = "message_queue", "消息队列"
    HTTP_API = "http_api", "HTTP 接口"


class DataSourceStatus(models.TextChoices):
    UNKNOWN = "unknown", "未校验"
    CONNECTED = "connected", "连接正常"
    ERROR = "error", "连接异常"
    DISABLED = "disabled", "已禁用"


class DataSource(BaseModel):
    """外部数据源对接配置(F13.3)。"""

    name = models.CharField(max_length=128, db_index=True, verbose_name="名称")
    source_type = models.CharField(
        max_length=32, choices=SourceType.choices, default=SourceType.DATABASE, db_index=True, verbose_name="数据源类型"
    )
    config = models.JSONField(default=dict, blank=True, verbose_name="连接配置")
    enabled = models.BooleanField(default=True, db_index=True, verbose_name="是否启用")
    status = models.CharField(
        max_length=16, choices=DataSourceStatus.choices, default=DataSourceStatus.UNKNOWN, db_index=True
    )
    last_sync_at = models.DateTimeField(null=True, blank=True, verbose_name="最近同步时间")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_data_sources"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "数据源"
        verbose_name_plural = "数据源"
        indexes = [models.Index(fields=["source_type", "status"])]
        constraints = [
            models.UniqueConstraint(fields=["name"], condition=Q(is_deleted=False), name="uniq_data_source_name_alive")
        ]

    def __str__(self):
        return f"{self.name}[{self.source_type}]"


class TrainingPlatform(BaseModel):
    """训练平台对接配置(F13.4)。"""

    name = models.CharField(max_length=128, db_index=True, verbose_name="名称")
    platform_type = models.CharField(max_length=32, db_index=True, verbose_name="平台类型")
    endpoint = models.URLField(max_length=512, blank=True, verbose_name="推送端点")
    config = models.JSONField(default=dict, blank=True, verbose_name="配置")
    enabled = models.BooleanField(default=True, db_index=True, verbose_name="是否启用")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_training_platforms"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "训练平台"
        verbose_name_plural = "训练平台"
        constraints = [
            models.UniqueConstraint(
                fields=["name"], condition=Q(is_deleted=False), name="uniq_training_platform_name_alive"
            )
        ]

    def __str__(self):
        return f"{self.name}({self.platform_type})"


class PushStatus(models.TextChoices):
    PENDING = "pending", "待推送"
    SUCCESS = "success", "成功"
    FAILED = "failed", "失败"


class PushRecord(BaseModel):
    """训练平台推送记录(F13.4)。"""

    platform = models.ForeignKey(TrainingPlatform, on_delete=models.CASCADE, related_name="push_records")
    task = models.ForeignKey("tasks.Task", on_delete=models.CASCADE, related_name="push_records")
    status = models.CharField(
        max_length=16, choices=PushStatus.choices, default=PushStatus.PENDING, db_index=True
    )
    payload = models.JSONField(default=dict, blank=True, verbose_name="推送载荷")
    response = models.JSONField(default=dict, blank=True, verbose_name="响应结果")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_push_records"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "训练平台推送记录"
        verbose_name_plural = "训练平台推送记录"
        indexes = [models.Index(fields=["platform", "status"]), models.Index(fields=["task", "status"])]

    def __str__(self):
        return f"Push#{self.id} task#{self.task_id} [{self.status}]"


class Provider(models.TextChoices):
    OAUTH2 = "oauth2", "OAuth2"
    SAML = "saml", "SAML"
    OIDC = "oidc", "OIDC"


class SSOConfig(BaseModel):
    """单点登录配置(F13.5)。"""

    name = models.CharField(max_length=128, db_index=True, verbose_name="名称")
    provider = models.CharField(
        max_length=16, choices=Provider.choices, default=Provider.OAUTH2, db_index=True, verbose_name="协议"
    )
    config = models.JSONField(default=dict, blank=True, verbose_name="配置")
    enabled = models.BooleanField(default=True, db_index=True, verbose_name="是否启用")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_sso_configs"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "SSO配置"
        verbose_name_plural = "SSO配置"
        constraints = [
            models.UniqueConstraint(fields=["name"], condition=Q(is_deleted=False), name="uniq_sso_config_name_alive")
        ]

    def __str__(self):
        return f"{self.name}[{self.provider}]"
