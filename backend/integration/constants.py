"""integration 应用常量：领域错误码、文案映射与数据源必需配置字段。"""


class IntegrationErrorCode:
    """F13 领域错误码（沿用 4xxxx 客户端错误段）。"""

    TASK_REQUIRED = 47001
    TASK_NOT_FOUND = 47002
    ENDPOINT_MISSING = 47003
    MISSING_CONFIG = 47004
    MISSING_PARAM = 47005
    UNAUTHORIZED = 47006
    SCOPE_FORBIDDEN = 47007


INTEGRATION_ERROR_MESSAGE = {
    IntegrationErrorCode.TASK_REQUIRED: "缺少任务参数 task",
    IntegrationErrorCode.TASK_NOT_FOUND: "任务不存在",
    IntegrationErrorCode.ENDPOINT_MISSING: "目标端点 endpoint 未配置",
    IntegrationErrorCode.MISSING_CONFIG: "数据源配置不完整",
    IntegrationErrorCode.MISSING_PARAM: "缺少必要参数",
    IntegrationErrorCode.UNAUTHORIZED: "API Key 无效或缺失",
    IntegrationErrorCode.SCOPE_FORBIDDEN: "API Key 缺少所需授权范围",
}

# 不同数据源类型做连接校验时必需的 config 字段（映射表）
REQUIRED_CONFIG_KEYS = {
    "database": ["host", "database"],
    "object_storage": ["endpoint", "bucket"],
    "message_queue": ["brokers"],
    "http_api": ["url"],
}
