"""compliance 应用权限：复用 core.permissions.allow_roles。"""
from rest_framework.permissions import IsAuthenticated

from core.permissions import allow_roles

# 读：任意登录用户
ComplianceReadPermission = IsAuthenticated
# 操作审计日志读：与 core.views.audit_logs 口径一致（管理员/运营）
ComplianceAuditReadPermission = allow_roles("admin", "operator")
# 分级/策略/环境/清单 写：运营、项目经理及以上
ComplianceManagePermission = allow_roles("admin", "operator", "pm")
# 安全敏感项（水印生成、生命周期执行）：仅管理员
ComplianceSecurityPermission = allow_roles("admin")
