"""specs 应用权限：复用 core.permissions.allow_roles。"""
from rest_framework.permissions import IsAuthenticated

from core.permissions import allow_roles

# 读：任意登录用户
SpecReadPermission = IsAuthenticated
# 规范文档写：运营 / 项目经理及以上
SpecManagePermission = allow_roles("admin", "operator", "pm")
# 发布 / 初稿生成 / 影响分析：算法工程师、项目经理及以上
SpecPublishPermission = allow_roles("admin", "engineer", "pm")
# 争议认领 / 裁决：专家口径（工程师 / 运营 / 项目经理）
DisputeHandlePermission = allow_roles("admin", "engineer", "operator")
