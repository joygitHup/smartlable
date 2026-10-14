"""Webhook 投递服务(F13.2)：真实发起测试投递，失败如实记录。"""
from django.db import transaction

from core.models import log_action

from ..models import DeliveryStatus, Webhook, WebhookDelivery
from ..utils import post_json


@transaction.atomic
def _record(webhook: Webhook, event: str, payload: dict, result: dict, user=None) -> WebhookDelivery:
    status = DeliveryStatus.SUCCESS if result["ok"] else DeliveryStatus.FAILED
    delivery = WebhookDelivery.objects.create(
        webhook=webhook,
        event=event,
        payload=payload,
        status=status,
        response_code=result["status_code"],
        attempts=1,
        error=result["error"] or "",
    )
    log_action(user, "integration:webhook_test", "webhook", webhook.id,
               {"delivery_id": delivery.id, "status": status, "response_code": result["status_code"]})
    return delivery


def send_test_delivery(webhook: Webhook, event: str = "test", payload: dict = None, user=None) -> WebhookDelivery:
    """向 Webhook 地址真实发起一次 POST 投递并落库（不伪造成功）。

    外部调用在网络请求完成后再落库，避免把慢请求放进事务。
    """
    payload = payload if isinstance(payload, dict) and payload else {"event": event, "test": True, "webhook": webhook.name}
    headers = {"X-Webhook-Secret": webhook.secret} if webhook.secret else None
    result = post_json(webhook.url, payload, headers=headers)
    return _record(webhook, event, payload, result, user)


def dispatch(event: str, payload: dict) -> dict:
    """事件驱动投递(F13.2)：向所有订阅该事件的启用 Webhook 真实 POST 并落库。

    best-effort：单个 Webhook 失败不影响其它投递，也不阻断主流程；
    未订阅该事件的 Webhook 跳过（events 为空表示未订阅任何事件）。
    """
    hooks = Webhook.objects.filter(enabled=True)
    results = []
    for hook in hooks:
        events = hook.events or []
        if not events or event not in events:
            continue
        body = {"event": event, **(payload or {})}
        headers = {"X-Webhook-Secret": hook.secret} if hook.secret else None
        result = post_json(hook.url, body, headers=headers)
        delivery = _record(hook, event, body, result, None)
        results.append({"webhook_id": hook.id, "delivery_id": delivery.id, "ok": result["ok"]})
    return {"event": event, "delivered": len(results), "results": results}
