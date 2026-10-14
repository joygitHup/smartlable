"""llmops 应用权限：复用 core.permissions.allow_roles。"""
from rest_framework.permissions import IsAuthenticated

from core.permissions import allow_roles

# 读：任意登录用户
LlmopsReadPermission = IsAuthenticated
# Prompt / 蒸馏 / 多轮 / 成本 / 检测 写：运营、算法工程师、项目经理及以上
LlmopsManagePermission = allow_roles("admin", "operator", "engineer", "pm")
