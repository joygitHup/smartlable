"""integration 应用权限：复用 core.permissions.allow_roles。"""
from rest_framework.permissions import IsAuthenticated

from core.permissions import allow_roles

# 读：任意登录用户
IntegrationReadPermission = IsAuthenticated
# 客户端 / Webhook / 数据源 / 平台 写：运营、项目经理及以上
IntegrationManagePermission = allow_roles("admin", "operator", "pm")
# 密钥敏感项（密钥轮换、SSO 配置写）：仅管理员
IntegrationSecretPermission = allow_roles("admin")
