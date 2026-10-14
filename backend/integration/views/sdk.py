"""SDK/CLI 支撑视图(F13.6)：只读返回调用说明。"""
from rest_framework import viewsets

from common.response import ok

from ..permissions import IntegrationReadPermission


class SDKInfoViewSet(viewsets.ViewSet):
    """GET /integration/sdk-info：返回 base_url 提示与鉴权方式说明。"""

    permission_classes = [IntegrationReadPermission]

    def info(self, request):
        return ok(
            {
                "base_url": "/api/v1",
                "auth_type": "Token",
                "auth_header": "Authorization: Token <key>",
                "client_endpoint": "/api/v1/integration/clients",
                "openapi_schema": "/api/schema",
                "open_api_auth_header": "X-API-Key: <client.key>",
                "open_api_endpoints": [
                    "POST /api/v1/integration/open-api/tasks （需 tasks:write）",
                    "GET /api/v1/integration/open-api/tasks/{id}/results （需 tasks:read）",
                ],
                "notes": "站内接口用 integration/clients 生成的 key 作为 Token 访问；"
                "业务系统对接走 X-API-Key 开放接口，scope 在客户端配置。",
            }
        )
