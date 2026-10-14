"""统一分页：{code, message, data:{list,total,page,pageSize}}。"""
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .constants import ErrorCode


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "pageSize"
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response(
            {
                "code": ErrorCode.OK,
                "message": "ok",
                "data": {
                    "list": data,
                    "total": self.page.paginator.count,
                    "page": self.page.number,
                    "pageSize": self.get_page_size(self.request),
                },
            }
        )
