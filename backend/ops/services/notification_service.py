"""站内通知服务(F14.2)：事件驱动生成通知 + 标记已读。"""
from core.models import User

from ..constants import OPS_ERROR_MESSAGE, OpsErrorCode
from ..models import Notification
from ..utils import business_error


def notify(recipients=None, roles=None, title="", content="", category="", ref_type="", ref_id="") -> int:
    """按接收人或角色批量创建站内通知(F14.2)，供争议/返工/任务完成等业务事件调用。

    recipients 支持单个用户或用户列表；roles 支持单个角色或角色列表；两者可同时使用。
    返回实际创建的通知条数。
    """
    targets = {}
    if recipients is not None:
        for r in recipients if isinstance(recipients, (list, tuple)) else [recipients]:
            if r is not None:
                targets[r.id] = r
    if roles:
        for u in User.objects.filter(role__in=list(roles) if isinstance(roles, (list, tuple)) else [roles]):
            targets[u.id] = u

    notifications = [
        Notification(
            recipient=user,
            title=title,
            content=content,
            category=category,
            ref_type=ref_type,
            ref_id=str(ref_id or ""),
        )
        for user in targets.values()
    ]
    if notifications:
        Notification.objects.bulk_create(notifications)
    return len(notifications)


def mark_read(notification: Notification, user) -> Notification:
    """标记单条通知已读，仅限通知接收人。"""
    if notification.recipient_id != user.id:
        raise business_error(OpsErrorCode.NOTIFICATION_FORBIDDEN, status_code=403)
    if not notification.is_read:
        notification.is_read = True
        notification.save(update_fields=["is_read", "updated_at"])
    return notification


def mark_all_read(user) -> int:
    """将当前用户所有未读通知标记为已读，返回受影响条数。"""
    return Notification.objects.filter(recipient=user, is_read=False).update(is_read=True)
