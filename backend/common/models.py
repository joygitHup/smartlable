"""公共模型基类：时间戳 + 软删除。"""
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    """统一时间戳字段。"""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteQuerySet(models.QuerySet):
    """带软删除语义的 QuerySet。"""

    def alive(self):
        return self.filter(is_deleted=False)

    def dead(self):
        return self.filter(is_deleted=True)

    def delete(self):
        return self.update(is_deleted=True, deleted_at=timezone.now())

    def hard_delete(self):
        return super().delete()


class SoftDeleteManager(models.Manager.from_queryset(SoftDeleteQuerySet)):
    """默认只返回未删除记录。"""

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class AllObjectsManager(models.Manager.from_queryset(SoftDeleteQuerySet)):
    """包含已删除记录。"""


class BaseModel(TimeStampedModel):
    """业务模型基类：带软删除。"""

    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = AllObjectsManager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=["is_deleted", "deleted_at"])

    def hard_delete(self, using=None, keep_parents=False):
        return super().delete(using=using, keep_parents=keep_parents)
