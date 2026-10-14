"""qc 非 CRUD 动作视图：金标注入 / 作弊检测 / 交叉复核指派 / 画像重建 / 趋势。"""
from rest_framework import viewsets

from common.constants import ErrorCode
from common.response import ok
from core.models import User
from tasks.models import Task, Unit

from ..constants import QcErrorCode
from ..models import GoldSample
from ..permissions import QcDetectPermission, QcManagePermission
from ..serializers import AnnotatorProfileListSerializer, CheatDetectionListSerializer, CrossReviewListSerializer
from ..serializers import GoldInjectionSerializer
from ..services import cheat_service, cross_service, gold_service, profile_service, trend_service
from ..utils import as_list, business_error, to_int


def _get_task(request):
    task_id = request.data.get("task") or request.data.get("task_id")
    if not task_id:
        raise business_error(QcErrorCode.MISSING_INPUT, "缺少任务参数 task", status_code=400)
    try:
        return Task.objects.get(id=task_id)
    except Task.DoesNotExist:
        raise business_error(ErrorCode.NOT_FOUND, "任务不存在", status_code=404)


def _get_user(user_id, label="用户"):
    if not user_id:
        return None
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        raise business_error(ErrorCode.NOT_FOUND, f"{label}不存在", status_code=404)


class GoldInjectViewSet(viewsets.ViewSet):
    """POST /qc/gold/inject：把金标样本混入任务队列。"""

    permission_classes = [QcManagePermission]

    def gold_inject(self, request):
        task = _get_task(request)
        sample_ids = as_list(request.data.get("sample_ids") or request.data.get("sample"))
        if not sample_ids:
            raise business_error(QcErrorCode.SAMPLE_REQUIRED, status_code=400)
        samples = list(GoldSample.objects.filter(id__in=sample_ids, active=True))
        if not samples:
            raise business_error(QcErrorCode.SAMPLE_REQUIRED, "未找到有效的金标样本", status_code=400)
        assigned_to = _get_user(request.data.get("assigned_to"), "标注员")
        injections = gold_service.inject_gold(
            task, samples, batch=request.data.get("batch", ""), assigned_to=assigned_to, user=request.user
        )
        return ok(
            {"task_id": task.id, "injected": len(injections),
             "injections": GoldInjectionSerializer(injections, many=True).data}
        )


class CheatDetectViewSet(viewsets.ViewSet):
    """POST /qc/cheat/detect：跑作弊检测并落库。"""

    permission_classes = [QcDetectPermission]

    def cheat_detect(self, request):
        task = _get_task(request)
        detections = cheat_service.detect_cheating(task, request.user)
        return ok({"task_id": task.id, "detections": CheatDetectionListSerializer(detections, many=True).data})


class CrossReviewAssignViewSet(viewsets.ViewSet):
    """POST /qc/cross-review：指派两位复核人复核同一批 unit。"""

    permission_classes = [QcManagePermission]

    def cross_review(self, request):
        reviewer_a = _get_user(request.data.get("reviewer_a"), "复核人A")
        reviewer_b = _get_user(request.data.get("reviewer_b"), "复核人B")
        if not reviewer_a or not reviewer_b:
            raise business_error(QcErrorCode.REVIEWER_REQUIRED, status_code=400)
        if reviewer_a.id == reviewer_b.id:
            raise business_error(ErrorCode.INVALID_PARAM, "复核人 A 与 B 不能为同一人", status_code=400)

        unit_ids = as_list(request.data.get("unit_ids") or request.data.get("units"))
        unit_id = request.data.get("unit") or request.data.get("unit_id")
        if unit_id:
            unit_ids.append(unit_id)
        units = Unit.objects.filter(id__in=unit_ids) if unit_ids else []
        if not unit_ids:
            task = _get_task(request)
            count = to_int(request.data.get("count"), 20)
            units = Unit.objects.filter(task=task).order_by("id")[:count]
        created = cross_service.assign_cross_reviews(units, reviewer_a, reviewer_b, user=request.user)
        return ok({"count": len(created), "cross_reviews": CrossReviewListSerializer(created, many=True).data})


class ProfileRebuildViewSet(viewsets.ViewSet):
    """POST /qc/profiles/rebuild：依据已有 Unit 重建标注员画像。"""

    permission_classes = [QcDetectPermission]

    def rebuild(self, request):
        task_type = request.data.get("task_type")
        annotator = _get_user(request.data.get("annotator") or request.data.get("annotator_id"), "标注员")
        profiles = profile_service.rebuild_profiles(task_type=task_type, annotator=annotator, user=request.user)
        return ok({"count": len(profiles), "profiles": AnnotatorProfileListSerializer(profiles, many=True).data})


class TrendsViewSet(viewsets.ViewSet):
    """GET /qc/trends：按天返回质量趋势（可落库）。"""

    permission_classes = [QcDetectPermission]

    def trends(self, request):
        task_type = request.query_params.get("task_type")
        annotator = _get_user(request.query_params.get("annotator") or request.query_params.get("annotator_id"), "标注员")
        task_id = request.query_params.get("task") or request.query_params.get("task_id")
        task = None
        if task_id:
            try:
                task = Task.objects.get(id=task_id)
            except Task.DoesNotExist:
                raise business_error(ErrorCode.NOT_FOUND, "任务不存在", status_code=404)
        persist = str(request.query_params.get("persist", "")).lower() in ("1", "true", "yes")
        if persist:
            rows = trend_service.persist_trends(task_type=task_type, annotator=annotator, task=task, user=request.user)
            trends = [{"date": r.date.isoformat(), "annotator_id": r.annotator_id, "task_id": r.task_id,
                       "accuracy": r.accuracy, "sample_size": r.sample_size} for r in rows]
        else:
            trends = trend_service.compute_trends(task_type=task_type, annotator=annotator, task=task)
        return ok({"trends": trends, "count": len(trends)})
