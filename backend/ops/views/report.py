"""运营报表视图(F14.4)：CRUD + 生成。"""
from rest_framework import viewsets
from rest_framework.decorators import action

from common.response import ok

from ..filters import filter_reports
from ..models import Report
from ..pagination import OpsPagination
from ..permissions import OpsManagePermission, OpsReadPermission
from ..serializers import ReportDetailSerializer, ReportGenerateSerializer, ReportListSerializer, ReportWriteSerializer
from ..services import report_service
from .base import EnvelopeViewSetMixin


class ReportViewSet(EnvelopeViewSetMixin, viewsets.ModelViewSet):
    queryset = Report.objects.select_related("generated_by")
    pagination_class = OpsPagination

    def get_queryset(self):
        return filter_reports(super().get_queryset(), self.request.query_params)

    def get_serializer_class(self):
        if self.action == "list":
            return ReportListSerializer
        if self.action == "retrieve":
            return ReportDetailSerializer
        return ReportWriteSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [OpsReadPermission()]
        return [OpsManagePermission()]

    def perform_create(self, serializer):
        serializer.save(generated_by=self.request.user)

    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        serializer = ReportGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        report = report_service.generate_report(
            report_type=data["report_type"],
            period_start=data.get("period_start"),
            period_end=data.get("period_end"),
            user=request.user,
        )
        return ok(ReportDetailSerializer(report).data)
