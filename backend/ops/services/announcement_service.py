"""公告发布服务(F14.2)：发布公告并向目标角色用户扇出站内通知。"""
from django.db import transaction

from core.models import User, log_action

from ..constants import OPS_ERROR_MESSAGE, OpsErrorCode
from ..models import Announcement, Notification
from ..utils import business_error, now


@transaction.atomic
def publish_announcement(announcement: Announcement, user=None) -> dict:
    """发布公告：置发布状态与时间，并按 target_roles 生成通知。"""
    if announcement.published:
        raise business_error(OpsErrorCode.ANNOUNCEMENT_PUBLISHED, status_code=409)

    announcement.published = True
    announcement.published_at = now()
    announcement.save(update_fields=["published", "published_at", "updated_at"])

    roles = announcement.target_roles or []
    recipients = User.objects.all()
    if roles:
        recipients = recipients.filter(role__in=roles)

    notifications = [
        Notification(
            recipient=recipient,
            title=announcement.title,
            content=announcement.content,
            category="announcement",
            ref_type="announcement",
            ref_id=str(announcement.id),
        )
        for recipient in recipients
    ]
    Notification.objects.bulk_create(notifications)

    log_action(user, "ops:announcement_publish", "announcement", announcement.id,
               {"notified": len(notifications), "target_roles": roles})
    return {"announcement": announcement, "notified": len(notifications)}
