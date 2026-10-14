"""qc 应用常量：领域错误码与文案映射。"""


class QcErrorCode:
    """F11 领域错误码（沿用 4xxxx 客户端错误段）。"""

    UNIT_NOT_FOUND = 45001
    UNIT_REQUIRED = 45002
    SAMPLE_REQUIRED = 45003
    INVALID_STATUS = 45004
    MISSING_INPUT = 45005
    REVIEWER_REQUIRED = 45006
    ANNOTATOR_REQUIRED = 45007


QC_ERROR_MESSAGE = {
    QcErrorCode.UNIT_NOT_FOUND: "数据单元不存在",
    QcErrorCode.UNIT_REQUIRED: "缺少数据单元参数 unit",
    QcErrorCode.SAMPLE_REQUIRED: "缺少金标样本参数 sample",
    QcErrorCode.INVALID_STATUS: "当前状态不允许该操作",
    QcErrorCode.MISSING_INPUT: "缺少必要参数",
    QcErrorCode.REVIEWER_REQUIRED: "缺少复核人参数",
    QcErrorCode.ANNOTATOR_REQUIRED: "缺少标注员参数",
}
