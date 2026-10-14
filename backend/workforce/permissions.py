"""workforce 应用权限：复用 core.permissions.allow_roles。"""
from rest_framework.permissions import IsAuthenticated

from core.permissions import allow_roles

# 读：任意登录用户
WorkforceReadPermission = IsAuthenticated
# 调度 / 薪资 / 班次 / 供应商等写操作：运营、项目经理及以上
WorkforceManagePermission = allow_roles("admin", "operator", "pm")
# 分配动作：运营、项目经理及以上
WorkforceAssignPermission = allow_roles("admin", "operator", "pm")
