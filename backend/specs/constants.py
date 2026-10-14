"""specs 应用常量：领域错误码与文案映射。"""


class SpecErrorCode:
    """F8 领域错误码（沿用 4xxxx 客户端错误段）。"""

    VERSION_NOT_FOUND = 42001
    VERSION_EXISTS = 42002
    DISPUTE_INVALID_STATUS = 42003
    DRAFT_GENERATION_FAILED = 42004
    MISSING_SOURCE = 42005


SPEC_ERROR_MESSAGE = {
    SpecErrorCode.VERSION_NOT_FOUND: "规范版本不存在",
    SpecErrorCode.VERSION_EXISTS: "该版本号已存在",
    SpecErrorCode.DISPUTE_INVALID_STATUS: "争议单当前状态不允许该操作",
    SpecErrorCode.DRAFT_GENERATION_FAILED: "规范初稿生成失败",
    SpecErrorCode.MISSING_SOURCE: "缺少可用于生成初稿的任务或文本",
}
