"""llmops 应用常量：领域错误码与文案映射。"""


class LlmopsErrorCode:
    """F15 领域错误码（沿用 4xxxx 客户端错误段）。"""

    TEMPLATE_NOT_FOUND = 47001
    VERSION_REQUIRED = 47002
    VERSION_NOT_FOUND = 47003
    UNIT_REQUIRED = 47004
    UNIT_NOT_FOUND = 47005
    TASK_REQUIRED = 47006
    TASK_NOT_FOUND = 47007
    INVALID_STATUS = 47008
    SESSION_CLOSED = 47009
    METRICS_REQUIRED = 47010


LLMOPS_ERROR_MESSAGE = {
    LlmopsErrorCode.TEMPLATE_NOT_FOUND: "Prompt 模板不存在",
    LlmopsErrorCode.VERSION_REQUIRED: "缺少可发布的 Prompt 版本",
    LlmopsErrorCode.VERSION_NOT_FOUND: "指定版本不存在",
    LlmopsErrorCode.UNIT_REQUIRED: "缺少数据单元参数 unit",
    LlmopsErrorCode.UNIT_NOT_FOUND: "数据单元不存在",
    LlmopsErrorCode.TASK_REQUIRED: "缺少任务参数 task",
    LlmopsErrorCode.TASK_NOT_FOUND: "任务不存在",
    LlmopsErrorCode.INVALID_STATUS: "当前状态不允许该操作",
    LlmopsErrorCode.SESSION_CLOSED: "多轮标注会话已关闭",
    LlmopsErrorCode.METRICS_REQUIRED: "缺少真实指标 metrics",
}
