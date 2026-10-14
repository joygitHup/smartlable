"""compliance 应用常量：领域错误码、文案映射与生命周期标记。"""


class ComplianceErrorCode:
    """F12 领域错误码（沿用 4xxxx 客户端错误段）。"""

    INVALID_STATUS = 46001
    MISSING_TARGET = 46002
    POLICY_REQUIRED = 46003
    CHECKLIST_REQUIRED = 46004
    INVALID_ACTION = 46005


COMPLIANCE_ERROR_MESSAGE = {
    ComplianceErrorCode.INVALID_STATUS: "状态取值非法",
    ComplianceErrorCode.MISSING_TARGET: "缺少目标参数 target_type/target_id",
    ComplianceErrorCode.POLICY_REQUIRED: "缺少生命周期策略参数 policy",
    ComplianceErrorCode.CHECKLIST_REQUIRED: "缺少合规检查项参数 checklist",
    ComplianceErrorCode.INVALID_ACTION: "生命周期动作非法",
}

# 数据生命周期执行后写入 Unit.status 的标记值（Unit 无独立软删除字段，
# 通过状态标记实现"软删除/归档"语义，标记后数据将不再进入常规处理流程）。
LIFECYCLE_DELETE_MARK = "lifecycle_deleted"
LIFECYCLE_ARCHIVE_MARK = "lifecycle_archived"
