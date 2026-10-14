"""交叉复核服务(F11.3)：指派两人对同一批 unit 独立复核。"""
from django.db import transaction

from core.models import log_action

from ..models import CrossReview, CrossReviewStatus


@transaction.atomic
def assign_cross_reviews(units, reviewer_a, reviewer_b, user=None) -> list:
    """为一批 unit 创建交叉复核记录（跳过已有待复核记录）。"""
    created = []
    for unit in units:
        if CrossReview.objects.filter(unit=unit, status=CrossReviewStatus.PENDING).exists():
            continue
        created.append(
            CrossReview.objects.create(
                unit=unit,
                reviewer_a=reviewer_a,
                reviewer_b=reviewer_b,
                status=CrossReviewStatus.PENDING,
            )
        )
    log_action(user, "qc:cross_assign", "unit_batch", len(created),
               {"reviewer_a": getattr(reviewer_a, "id", None), "reviewer_b": getattr(reviewer_b, "id", None),
                "count": len(created)})
    return created
