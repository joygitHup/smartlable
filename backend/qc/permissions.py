"""qc 应用权限：复用 core.permissions.allow_roles。"""
from rest_framework.permissions import IsAuthenticated

from core.permissions import allow_roles

# 读：任意登录用户
QcReadPermission = IsAuthenticated
# 金标 / 交叉复核 / 返工 写：运营、项目经理及以上
QcManagePermission = allow_roles("admin", "operator", "pm")
# 作弊检测 / 画像重建 / 趋势：运营、算法工程师、项目经理及以上
QcDetectPermission = allow_roles("admin", "operator", "engineer", "pm")
# 申诉处理：运营、项目经理及以上
QcAppealHandlePermission = allow_roles("admin", "operator", "pm")
