"""ops 非 CRUD 聚合视图：数据看板 / 标注员排行榜。"""
from rest_framework import viewsets

from common.response import ok

from ..permissions import OpsReadPermission
from ..services import dashboard_service, leaderboard_service
from ..utils import to_int


class DashboardViewSet(viewsets.ViewSet):
    """GET /ops/dashboard：聚合任务/单元真实运营指标。"""

    permission_classes = [OpsReadPermission]

    def dashboard(self, request):
        days = to_int(request.query_params.get("days"), 7)
        return ok(dashboard_service.build_dashboard(days=max(1, min(days, 30))))


class LeaderboardViewSet(viewsets.ViewSet):
    """GET /ops/leaderboard：按准确率/产量对标注员排名。"""

    permission_classes = [OpsReadPermission]

    def leaderboard(self, request):
        anonymous = str(request.query_params.get("anonymous", "")).lower() in ("1", "true", "yes")
        sort_by = request.query_params.get("sort_by", "accuracy")
        limit = to_int(request.query_params.get("limit"), 50)
        items = leaderboard_service.build_leaderboard(
            anonymous=anonymous, sort_by=sort_by, limit=max(1, min(limit, 200))
        )
        return ok({"leaderboard": items, "count": len(items)})
