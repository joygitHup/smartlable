"""ops 应用常量：领域错误码与文案映射。"""


class OpsErrorCode:
    """F14 领域错误码（沿用 4xxxx 客户端错误段）。"""

    TASK_NOT_FOUND = 46001
    UNIT_NOT_FOUND = 46002
    MISSING_INPUT = 46003
    INVALID_STATUS = 46004
    PERIOD_INVALID = 46005
    NOTIFICATION_FORBIDDEN = 46006
    ANNOUNCEMENT_PUBLISHED = 46007


OPS_ERROR_MESSAGE = {
    OpsErrorCode.TASK_NOT_FOUND: "任务不存在",
    OpsErrorCode.UNIT_NOT_FOUND: "数据单元不存在",
    OpsErrorCode.MISSING_INPUT: "缺少必要参数",
    OpsErrorCode.INVALID_STATUS: "当前状态不允许该操作",
    OpsErrorCode.PERIOD_INVALID: "报表周期不合法",
    OpsErrorCode.NOTIFICATION_FORBIDDEN: "无权操作该通知",
    OpsErrorCode.ANNOUNCEMENT_PUBLISHED: "公告已发布",
}
