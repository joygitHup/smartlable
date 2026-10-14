"""开放 API 客户端服务(F13.1)：密钥轮换。"""
from django.db import transaction

from core.models import log_action

from ..models import APIClient
from ..utils import gen_key, gen_secret


@transaction.atomic
def rotate_client(client: APIClient, user=None) -> APIClient:
    """重新生成客户端的 key 与 secret。"""
    client.key = gen_key()
    client.secret = gen_secret()
    client.save(update_fields=["key", "secret", "updated_at"])
    log_action(user, "integration:client_rotate", "api_client", client.id, {"key": client.key})
    return client
