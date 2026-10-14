"""请求链路 ID 中间件：注入 request.id 并回写响应头。"""
import uuid


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.id = request.headers.get("X-Request-Id") or uuid.uuid4().hex
        response = self.get_response(request)
        response["X-Request-Id"] = request.id
        return response
