"""语义化角色权限（复用 core.permissions.RolePermission，ADMIN 全通）。"""
from core.permissions import RolePermission


class IsAdmin(RolePermission):
    allowed_roles = ()


class IsPMOrAdmin(RolePermission):
    allowed_roles = ("pm",)


class IsOperatorOrAdmin(RolePermission):
    allowed_roles = ("operator",)


class IsEngineerOrAdmin(RolePermission):
    allowed_roles = ("engineer",)


class IsManagerOrAdmin(RolePermission):
    """运营/项目经理及以上。"""

    allowed_roles = ("operator", "pm")


class IsAnnotatorOrAbove(RolePermission):
    allowed_roles = ("operator", "annotator", "pm")
