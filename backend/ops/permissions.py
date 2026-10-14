"""ops 应用权限：复用 core.permissions.allow_roles。"""
from rest_framework.permissions import IsAuthenticated

from core.permissions import allow_roles

# 读：任意登录用户
OpsReadPermission = IsAuthenticated
# 公告 / 评论 / 报表 / 反馈处理：运营、项目经理及以上
OpsManagePermission = allow_roles("admin", "operator", "pm")
# 反馈处理：运营、项目经理及以上
OpsHandlePermission = allow_roles("admin", "operator", "pm")
