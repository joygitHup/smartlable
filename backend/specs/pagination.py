"""specs 分页：复用统一 StandardPagination。"""
from common.pagination import StandardPagination


class SpecsPagination(StandardPagination):
    page_size = 20
