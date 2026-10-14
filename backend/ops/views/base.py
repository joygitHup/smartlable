"""统一 envelope 的 ViewSet 基类：列表走 StandardPagination，单对象/动作用 ok()。"""
from rest_framework import status

from common.response import ok


class EnvelopeViewSetMixin:
    """把 ModelViewSet 默认响应包装为 {code,message,data}。"""

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return ok(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        response = ok(serializer.data)
        response.status_code = status.HTTP_201_CREATED
        for key, value in headers.items():
            response[key] = value
        return response

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return ok(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return ok(None)
