"""水印与溯源服务(F12.2)。"""
from django.db import transaction

from core.models import log_action

from ..models import Watermark
from ..utils import content_hash, gen_token


@transaction.atomic
def generate_watermark(target_type: str, target_id, text: str = "", user=None) -> Watermark:
    """生成水印与溯源标识并落库。"""
    token = gen_token()
    digest = content_hash(target_type, target_id, text, token)
    watermark = Watermark.objects.create(
        target_type=target_type,
        target_id=str(target_id),
        text=text or "",
        token=token,
        hash=digest,
        created_by=user,
    )
    log_action(user, "compliance:watermark_generate", target_type, target_id,
               {"watermark_id": watermark.id, "token": token})
    return watermark
