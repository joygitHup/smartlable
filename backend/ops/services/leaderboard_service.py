"""标注员排行榜服务(F14.5)：基于 Unit 人工结果 + 复用 qc.AnnotatorProfile。"""
from django.db.models import Avg, Count

from qc.models import AnnotatorProfile
from tasks.models import Unit

from ..utils import mask_name


def build_leaderboard(anonymous: bool = False, sort_by: str = "accuracy", limit: int = 50) -> list:
    """按准确率/产量对标注员排名，anonymous 时对用户名脱敏。"""
    data = {}

    # 产量：以人工审核过的 Unit 计数（真实聚合）
    production = (
        Unit.objects.filter(human_reviewed=True, reviewed_by__isnull=False)
        .values("reviewed_by", "reviewed_by__username")
        .annotate(output=Count("id"))
    )
    for row in production:
        aid = row["reviewed_by"]
        data[aid] = {
            "annotator_id": aid,
            "username": row["reviewed_by__username"] or "",
            "output": row["output"],
            "accuracy": 0.0,
        }

    # 准确率：复用 qc 的标注员能力画像（多任务类型取均值）
    profiles = (
        AnnotatorProfile.objects.values("annotator", "annotator__username")
        .annotate(accuracy=Avg("accuracy"), total_reviewed=Count("id"))
    )
    for row in profiles:
        aid = row["annotator"]
        item = data.setdefault(
            aid,
            {"annotator_id": aid, "username": row["annotator__username"] or "", "output": 0, "accuracy": 0.0},
        )
        item["accuracy"] = round(row["accuracy"] or 0.0, 4)

    items = list(data.values())
    if sort_by == "output":
        items.sort(key=lambda x: (x["output"], x["accuracy"]), reverse=True)
    else:
        items.sort(key=lambda x: (x["accuracy"], x["output"]), reverse=True)

    items = items[: max(limit, 0)]
    for idx, item in enumerate(items, 1):
        item["rank"] = idx
        if anonymous:
            item["username"] = mask_name(item["username"])
    return items
