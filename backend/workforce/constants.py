"""workforce 应用常量：领域错误码与文案映射。"""


class WorkforceErrorCode:
    """F9 领域错误码（沿用 4xxxx 客户端错误段）。"""

    NO_CANDIDATE = 43001
    NO_HISTORY = 43002
    QUEUE_NOT_FOUND = 43003
    TASK_REQUIRED = 43004


WORKFORCE_ERROR_MESSAGE = {
    WorkforceErrorCode.NO_CANDIDATE: "没有匹配技能且负载未满的标注员",
    WorkforceErrorCode.NO_HISTORY: "缺少可用于预估的历史工时记录",
    WorkforceErrorCode.QUEUE_NOT_FOUND: "队列条目不存在",
    WorkforceErrorCode.TASK_REQUIRED: "缺少任务参数",
}
