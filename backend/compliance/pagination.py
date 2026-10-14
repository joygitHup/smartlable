"""compliance 分页：复用统一 StandardPagination。"""
from common.pagination import StandardPagination


class CompliancePagination(StandardPagination):
    page_size = 20
