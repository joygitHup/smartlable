"""prelabel 应用权限：复用 core.permissions.allow_roles。"""
from rest_framework.permissions import IsAuthenticated

from core.permissions import allow_roles

# 读：任意登录用户
PrelabelReadPermission = IsAuthenticated
# 阈值 / 规则 / 长尾策略写：运营、算法工程师、项目经理及以上
PrelabelManagePermission = allow_roles("admin", "engineer", "operator", "pm")
# 阈值动态调优 / A/B 实验：算法工程师、项目经理及以上
PrelabelTunePermission = allow_roles("admin", "engineer", "pm")
# 预标注动作（解释/对比/降级/规则应用）：算法工程师、运营、项目经理及以上
PrelabelActionPermission = allow_roles("admin", "engineer", "operator", "pm")
