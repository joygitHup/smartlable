"""prelabel 应用常量：领域错误码与文案映射。"""


class PrelabelErrorCode:
    """F10 领域错误码（沿用 4xxxx 客户端错误段）。"""

    UNIT_REQUIRED = 44001
    UNIT_NOT_FOUND = 44002
    TASK_TYPE_REQUIRED = 44003
    NO_RULE_HIT = 44004
    EXPERIMENT_INVALID_STATUS = 44005
    THRESHOLD_NOT_FOUND = 44006
    LLM_FAILED = 44007
    MISSING_CANDIDATES = 44008


PRELABEL_ERROR_MESSAGE = {
    PrelabelErrorCode.UNIT_REQUIRED: "缺少数据单元参数 unit",
    PrelabelErrorCode.UNIT_NOT_FOUND: "数据单元不存在",
    PrelabelErrorCode.TASK_TYPE_REQUIRED: "缺少任务类型 task_type",
    PrelabelErrorCode.NO_RULE_HIT: "规则未命中",
    PrelabelErrorCode.EXPERIMENT_INVALID_STATUS: "实验当前状态不允许该操作",
    PrelabelErrorCode.THRESHOLD_NOT_FOUND: "类别阈值不存在",
    PrelabelErrorCode.LLM_FAILED: "模型推理失败",
    PrelabelErrorCode.MISSING_CANDIDATES: "缺少可用于对比的候选结果",
}
