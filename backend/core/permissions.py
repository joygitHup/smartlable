from rest_framework.permissions import BasePermission


class RolePermission(BasePermission):
    """
    通用角色权限：构造时指定允许的角色集合。
    ADMIN 默认拥有全部权限。
    """

    allowed_roles: tuple = ()

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.role == "admin":
            return True
        return user.role in self.allowed_roles


def allow_roles(*roles):
    """动态生成一个白名单角色权限类。"""

    class _Perm(RolePermission):
        allowed_roles = roles

    return _Perm